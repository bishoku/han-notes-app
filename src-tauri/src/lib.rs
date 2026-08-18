use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use regex::Regex;
use std::collections::{BTreeMap, BTreeSet};

use han_core::*;




const CONFIG_FILE_NAME: &str = "han_config.json";

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct HanConfig {
    vault_path: Option<String>,
}

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }
    Ok(data_dir.join(CONFIG_FILE_NAME))
}

// Helper to get vault path (reads custom path from config if present)
fn get_vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(config_path) = get_config_path(app) {
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(cfg) = serde_json::from_str::<HanConfig>(&content) {
                    if let Some(custom_path) = cfg.vault_path {
                        let path = PathBuf::from(&custom_path);
                        if path.exists() {
                            return Ok(path);
                        } else if fs::create_dir_all(&path).is_ok() {
                            return Ok(path);
                        }
                    }
                }
            }
        }
    }

    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let vault_dir = data_dir.join("vault");
    if !vault_dir.exists() {
        fs::create_dir_all(&vault_dir).map_err(|e| e.to_string())?;
    }
    Ok(vault_dir)
}

/// Resolve a note ID (with or without .md extension) to a full filesystem path.
#[inline]
fn resolve_note_path(vault_dir: &Path, id: &str) -> PathBuf {
    if id.ends_with(".md") {
        vault_dir.join(id)
    } else {
        vault_dir.join(format!("{}.md", id))
    }
}



fn find_file_in_vault(vault_dir: &Path, rel_path: &str) -> Option<PathBuf> {
    let direct = vault_dir.join(rel_path);
    if direct.exists() {
        return Some(direct);
    }

    let file_name = Path::new(rel_path).file_name()?.to_str()?;

    fn search_recursive(dir: &Path, target_name: &str) -> Option<PathBuf> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(found) = search_recursive(&path, target_name) {
                        return Some(found);
                    }
                } else if path.file_name().and_then(|n| n.to_str()) == Some(target_name) {
                    return Some(path);
                }
            }
        }
        None
    }

    search_recursive(vault_dir, file_name)
}

fn update_task_registry_file(vault_dir: &Path, tasks: &[TaskInfo]) {
    let attachments_dir = vault_dir.join(".attachments");
    if !attachments_dir.exists() {
        let _ = fs::create_dir_all(&attachments_dir);
    }
    let registry_file = attachments_dir.join("task_metadata.json");

    let mut assignees_set = BTreeSet::new();
    let mut tags_set = BTreeSet::new();

    for task in tasks {
        let assignee_sources: Vec<&str> = task.assignees.iter().map(|s| s.as_str()).chain(
            task.assignee.iter().map(|s| s.as_str())
        ).collect();
        assignees_set.extend(collect_comma_separated(assignee_sources));

        tags_set.extend(collect_comma_separated(task.tags.iter().map(|s| s.as_str())));
    }

    let registry = TaskRegistry {
        assignees: assignees_set.into_iter().collect(),
        tags: tags_set.into_iter().collect(),
    };

    if let Ok(json) = serde_json::to_string_pretty(&registry) {
        let _ = fs::write(registry_file, json);
    }
}

fn build_tree_recursive(dir: &Path, base_vault: &Path) -> Vec<FileNode> {
    let mut nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            
            if name.starts_with('.') {
                continue;
            }

            let is_dir = path.is_dir();
            let relative_path = path.strip_prefix(base_vault)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| name.clone());

            if is_dir {
                let children = build_tree_recursive(&path, base_vault);
                nodes.push(FileNode {
                    name,
                    relative_path,
                    is_dir: true,
                    children,
                });
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let display_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or(&name).to_string();
                nodes.push(FileNode {
                    name: display_name,
                    relative_path,
                    is_dir: false,
                    children: Vec::new(),
                });
            }
        }
    }

    nodes.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    nodes
}

#[tauri::command]
fn get_vault_tree(app: AppHandle) -> Result<Vec<FileNode>, String> {
    let vault_dir = get_vault_path(&app)?;
    let tree = build_tree_recursive(&vault_dir, &vault_dir);
    Ok(tree)
}

#[tauri::command]
fn read_text_asset(app: AppHandle, relative_path: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let full_path = find_file_in_vault(&vault_dir, &relative_path)
        .ok_or_else(|| "File not found in vault".to_string())?;
    
    fs::read_to_string(full_path).map_err(|e| e.to_string())
}

fn scan_vault_files_recursive(dir: &Path, base_vault: &Path, notes: &mut Vec<NoteInfo>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                scan_vault_files_recursive(&path, base_vault, notes);
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let rel_path = path.strip_prefix(base_vault)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let note_id = path_to_note_id(&rel_path);
                let title = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Untitled").to_string();
                let mut tags = Vec::new();
                if let Ok(file_str) = fs::read_to_string(&path) {
                    let (meta, _) = parse_yaml_frontmatter(&file_str);
                    tags = meta.tags;
                }

                notes.push(NoteInfo {
                    id: note_id,
                    title,
                    path: path.to_string_lossy().to_string(),
                    tags,
                });
            }
        }
    }
}

#[tauri::command]
fn get_vault_files(app: AppHandle) -> Result<Vec<NoteInfo>, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut notes = Vec::new();
    scan_vault_files_recursive(&vault_dir, &vault_dir, &mut notes);
    notes.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(notes)
}

#[tauri::command]
fn read_note(app: AppHandle, id: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &id);
    
    if note_path.exists() {
        fs::read_to_string(note_path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
fn write_note(app: AppHandle, id: String, content: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &id);
    
    if let Some(parent) = note_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(note_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(app: AppHandle, parent_path: String, folder_name: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let target_dir = if parent_path.is_empty() {
        vault_dir.join(&folder_name)
    } else {
        vault_dir.join(&parent_path).join(&folder_name)
    };
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_note_in_folder(app: AppHandle, parent_path: String, title: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let filename = if title.ends_with(".md") { title.clone() } else { format!("{}.md", title) };
    let target_path = if parent_path.is_empty() {
        vault_dir.join(&filename)
    } else {
        vault_dir.join(&parent_path).join(&filename)
    };
    
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let note_title = target_path.file_stem().and_then(|s| s.to_str()).unwrap_or(&title);
    let initial_content = format!("# {}\n", note_title);
    fs::write(target_path, initial_content).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_node(app: AppHandle, src_rel_path: String, dest_dir_rel_path: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let src_path = vault_dir.join(&src_rel_path);
    
    let file_name = src_path.file_name().ok_or("Invalid source path")?;
    let dest_path = if dest_dir_rel_path.is_empty() {
        vault_dir.join(file_name)
    } else {
        vault_dir.join(&dest_dir_rel_path).join(file_name)
    };

    if src_path == dest_path {
        return Ok(());
    }

    fs::rename(src_path, dest_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_node(app: AppHandle, relative_path: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let target_path = vault_dir.join(&relative_path);

    if target_path.is_dir() {
        fs::remove_dir_all(target_path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(target_path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn rename_node(app: AppHandle, relative_path: String, new_name: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let src_path = vault_dir.join(&relative_path);
    
    let parent = src_path.parent().ok_or("Invalid path")?;
    let dest_name = if !src_path.is_dir() && !new_name.ends_with(".md") {
        format!("{}.md", new_name)
    } else {
        new_name
    };
    let dest_path = parent.join(dest_name);

    fs::rename(src_path, dest_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_image_bytes(app: AppHandle, relative_note_id: String, file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let parent_dir = if relative_note_id.contains('/') {
        let parts: Vec<&str> = relative_note_id.split('/').collect();
        parts[..parts.len() - 1].join("/")
    } else {
        String::new()
    };

    let target_dir = if parent_dir.is_empty() {
        vault_dir.join(".attachments")
    } else {
        vault_dir.join(&parent_dir).join(".attachments")
    };

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    let target_path = target_dir.join(&file_name);
    fs::write(&target_path, &bytes).map_err(|e| e.to_string())?;

    let rel_path = if parent_dir.is_empty() {
        format!(".attachments/{}", file_name)
    } else {
        format!("{}/.attachments/{}", parent_dir, file_name)
    };

    Ok(rel_path)
}

#[tauri::command]
fn save_text_asset(app: AppHandle, relative_note_id: String, file_name: String, content: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let parent_dir = if relative_note_id.contains('/') {
        let parts: Vec<&str> = relative_note_id.split('/').collect();
        parts[..parts.len() - 1].join("/")
    } else {
        String::new()
    };

    let target_dir = if parent_dir.is_empty() {
        vault_dir.join(".attachments")
    } else {
        vault_dir.join(&parent_dir).join(".attachments")
    };

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    let target_path = target_dir.join(&file_name);
    fs::write(&target_path, content).map_err(|e| e.to_string())?;

    let relative_asset_path = if parent_dir.is_empty() {
        format!(".attachments/{}", file_name)
    } else {
        format!("{}/.attachments/{}", parent_dir, file_name)
    };

    Ok(relative_asset_path)
}

#[tauri::command]
fn get_image_data_url(app: AppHandle, relative_path: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let full_path = find_file_in_vault(&vault_dir, &relative_path)
        .ok_or_else(|| format!("File does not exist: {}", relative_path))?;

    let bytes = fs::read(&full_path).map_err(|e| e.to_string())?;

    let ext = full_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn resolve_asset_path(app: AppHandle, relative_path: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let full_path = find_file_in_vault(&vault_dir, &relative_path)
        .unwrap_or_else(|| vault_dir.join(&relative_path));
    Ok(full_path.to_string_lossy().to_string())
}


fn scan_tasks_recursive(dir: &Path, base_vault: &Path, tasks: &mut Vec<TaskInfo>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                scan_tasks_recursive(&path, base_vault, tasks);
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let rel_path = path.strip_prefix(base_vault)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let note_id = path_to_note_id(&rel_path);

                if let Ok(content) = fs::read_to_string(&path) {
                    for (i, line) in content.lines().enumerate() {
                        if let Some((completed, display_text, meta)) = parse_task_line(line) {
                            tasks.push(TaskInfo {
                                note_id: note_id.clone(),
                                line_number: i,
                                content: display_text,
                                completed,
                                description: meta.description,
                                start_date: meta.start_date,
                                end_date: meta.end_date,
                                priority: meta.priority,
                                assignee: meta.assignee.clone(),
                                assignees: meta.assignees,
                                progress: meta.progress,
                                tags: meta.tags,
                                raw_line: line.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn get_global_tasks(app: AppHandle) -> Result<Vec<TaskInfo>, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut tasks = Vec::new();
    scan_tasks_recursive(&vault_dir, &vault_dir, &mut tasks);
    update_task_registry_file(&vault_dir, &tasks);
    Ok(tasks)
}

#[tauri::command]
fn get_task_registry(app: AppHandle) -> Result<TaskRegistry, String> {
    let vault_dir = get_vault_path(&app)?;

    let mut tasks = Vec::new();
    scan_tasks_recursive(&vault_dir, &vault_dir, &mut tasks);
    update_task_registry_file(&vault_dir, &tasks);

    let mut assignees_set = BTreeSet::new();
    let mut tags_set = BTreeSet::new();

    for t in &tasks {
        assignees_set.extend(collect_comma_separated(t.assignees.iter().map(|s| s.as_str())));
        tags_set.extend(collect_comma_separated(t.tags.iter().map(|s| s.as_str())));
    }

    Ok(TaskRegistry {
        assignees: assignees_set.into_iter().collect(),
        tags: tags_set.into_iter().collect(),
    })
}

#[tauri::command]
fn toggle_task(app: AppHandle, note_id: String, line_number: usize, completed: bool) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &note_id);
    
    if !note_path.exists() {
        return Err("Note not found".to_string());
    }
    
    let content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    
    if line_number < lines.len() {
        let line = &lines[line_number];
        let new_line = if completed {
            line.replace("[ ]", "[x]")
        } else {
            line.replace("[x]", "[ ]").replace("[X]", "[ ]")
        };
        lines[line_number] = new_line;
        
        let new_content = lines.join("\n");
        fs::write(note_path, new_content).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn update_task_metadata(
    app: AppHandle,
    note_id: String,
    line_number: usize,
    content: String,
    completed: bool,
    description: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    priority: Option<String>,
    assignee: Option<String>,
    assignees: Vec<String>,
    progress: Option<u8>,
    tags: Vec<String>,
) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &note_id);

    if !note_path.exists() {
        return Err("Note not found".to_string());
    }

    let file_content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

    if line_number < lines.len() {
        let indent = lines[line_number]
            .chars()
            .take_while(|c| c.is_whitespace())
            .collect::<String>();
        let check_char = if completed { "x" } else { " " };
        
        let final_assignees_set = collect_comma_separated(
            assignees.iter().map(|s| s.as_str()).chain(
                assignee.iter().map(|s| s.as_str())
            )
        );
        let final_assignees: Vec<String> = final_assignees_set.into_iter().collect();

        let meta = TaskMeta {
            description: if description.as_ref().map_or(true, |s| s.trim().is_empty()) { None } else { description },
            start_date,
            end_date,
            priority,
            assignee: if final_assignees.is_empty() { None } else { Some(final_assignees.join(", ")) },
            assignees: final_assignees,
            progress,
            tags,
        };

        let has_meta = meta.description.is_some()
            || meta.start_date.is_some()
            || meta.end_date.is_some()
            || meta.priority.is_some()
            || !meta.assignees.is_empty()
            || meta.progress.is_some()
            || !meta.tags.is_empty();

        let new_line = if has_meta {
            let json_meta = serde_json::to_string(&meta).unwrap_or_default();
            format!("{}- [{}] {} <!-- task:{} -->", indent, check_char, content, json_meta)
        } else {
            format!("{}- [{}] {}", indent, check_char, content)
        };

        lines[line_number] = new_line;
        let new_content = lines.join("\n");
        fs::write(note_path, new_content).map_err(|e| e.to_string())?;
    }

    // Refresh central registry file
    let mut tasks = Vec::new();
    scan_tasks_recursive(&vault_dir, &vault_dir, &mut tasks);
    update_task_registry_file(&vault_dir, &tasks);

    Ok(())
}

fn scan_backlinks_recursive(dir: &Path, base_vault: &Path, target_note_id: &str, backlinks: &mut Vec<BacklinkInfo>, re: &Regex) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                scan_backlinks_recursive(&path, base_vault, target_note_id, backlinks, re);
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let rel_path = path.strip_prefix(base_vault)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let note_id = path_to_note_id(&rel_path);

                let file_title = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

                if note_id.eq_ignore_ascii_case(target_note_id) || file_title.eq_ignore_ascii_case(target_note_id) {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    for (i, line) in content.lines().enumerate() {
                        if re.is_match(line) {
                            backlinks.push(BacklinkInfo {
                                source_note_id: note_id.clone(),
                                snippet: line.trim().to_string(),
                                line_number: i,
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn get_backlinks(app: AppHandle, target_note_id: String) -> Result<Vec<BacklinkInfo>, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut backlinks = Vec::new();

    let title_stem = Path::new(&target_note_id)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&target_note_id);

    let pattern = format!(
        r"\[\[(?:{}|{})\s*(?:\|[^\]]*)?\]\]",
        regex::escape(&target_note_id),
        regex::escape(title_stem)
    );
    let re = match Regex::new(&pattern) {
        Ok(r) => r,
        Err(e) => return Err(e.to_string()),
    };

    scan_backlinks_recursive(&vault_dir, &vault_dir, &target_note_id, &mut backlinks, &re);
    Ok(backlinks)
}

#[tauri::command]
fn get_vault_path_str(app: AppHandle) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    Ok(vault_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn select_vault_folder(app: AppHandle) -> Result<Option<String>, String> {
    let current = get_vault_path(&app).ok();
    let mut dialog = rfd::FileDialog::new().set_title("Kasa Klasörü Seçin / Select Vault Folder");
    if let Some(ref cur) = current {
        dialog = dialog.set_directory(cur);
    }
    if let Some(picked) = dialog.pick_folder() {
        let picked_str = picked.to_string_lossy().to_string();
        let config_path = get_config_path(&app)?;
        let cfg = HanConfig {
            vault_path: Some(picked_str.clone()),
        };
        let content = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        Ok(Some(picked_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn set_vault_path(app: AppHandle, path: String) -> Result<String, String> {
    let target_path = PathBuf::from(&path);
    if !target_path.exists() {
        fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
    }
    let config_path = get_config_path(&app)?;
    let cfg = HanConfig {
        vault_path: Some(path.clone()),
    };
    let content = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_vault_tree,
            get_vault_files,
            get_vault_path_str,
            select_vault_folder,
            set_vault_path,
            read_note,
            write_note,
            create_folder,
            create_note_in_folder,
            move_node,
            delete_node,
            rename_node,
            get_global_tasks,
            get_task_registry,
            toggle_task,
            update_task_metadata,
            get_backlinks,
            save_image_bytes,
            save_text_asset,
            read_text_asset,
            get_image_data_url,
            resolve_asset_path,
            get_global_decisions,
            get_decision_registry,
            update_decision_metadata,
            get_vault_tags,
            update_note_tags,
            git_status,
            git_init,
            git_commit,
            git_log,
            git_diff,
            git_show,
            git_revert_file,
            git_remote_get,
            git_remote_set,
            git_pull,
            git_push
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_vault_tags(app: AppHandle) -> Result<Vec<TagCount>, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut notes = Vec::new();
    scan_vault_files_recursive(&vault_dir, &vault_dir, &mut notes);

    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for note in notes {
        for tag in note.tags {
            *counts.entry(tag).or_insert(0) += 1;
        }
    }

    let mut list: Vec<TagCount> = counts
        .into_iter()
        .map(|(tag, count)| TagCount { tag, count })
        .collect();

    list.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tag.cmp(&b.tag)));
    Ok(list)
}

#[tauri::command]
fn update_note_tags(app: AppHandle, id: String, tags: Vec<String>) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &id);

    if !note_path.exists() {
        return Err("Note not found".to_string());
    }

    let content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;
    let (mut meta, body) = parse_yaml_frontmatter(&content);
    meta.tags = tags;
    let new_content = inject_yaml_frontmatter(&meta, &body);

    fs::write(note_path, new_content).map_err(|e| e.to_string())?;
    Ok(())
}


fn update_decision_registry_file(vault_dir: &Path, decisions: &[DecisionInfo]) {
    let attachments_dir = vault_dir.join(".attachments");
    if !attachments_dir.exists() {
        let _ = fs::create_dir_all(&attachments_dir);
    }
    let registry_file = attachments_dir.join("decision_metadata.json");

    let mut participants_set = BTreeSet::new();
    let mut approved_by_set = BTreeSet::new();
    let mut tags_set = BTreeSet::new();

    for d in decisions {
        participants_set.extend(collect_comma_separated(d.participants.iter().map(|s| s.as_str())));
        approved_by_set.extend(collect_comma_separated(d.approved_by.iter().map(|s| s.as_str())));
        tags_set.extend(collect_comma_separated(d.tags.iter().map(|s| s.as_str())));
    }

    let registry = DecisionRegistry {
        participants: participants_set.into_iter().collect(),
        approved_by: approved_by_set.into_iter().collect(),
        tags: tags_set.into_iter().collect(),
    };

    if let Ok(json) = serde_json::to_string_pretty(&registry) {
        let _ = fs::write(registry_file, json);
    }
}


fn scan_decisions_recursive(dir: &Path, base_vault: &Path, decisions: &mut Vec<DecisionInfo>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                scan_decisions_recursive(&path, base_vault, decisions);
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let rel_path = path.strip_prefix(base_vault)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let note_id = path_to_note_id(&rel_path);

                if let Ok(content) = fs::read_to_string(&path) {
                    for (line_idx, line) in content.lines().enumerate() {
                        if let Some((display_text, meta)) = parse_decision_line(line) {
                            decisions.push(DecisionInfo {
                                note_id: note_id.clone(),
                                line_number: line_idx,
                                content: display_text,
                                description: meta.description,
                                date: meta.date,
                                status: meta.status,
                                participants: meta.participants,
                                approved_by: meta.approved_by,
                                tags: meta.tags,
                                raw_line: line.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn get_global_decisions(app: AppHandle) -> Result<Vec<DecisionInfo>, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut decisions = Vec::new();
    scan_decisions_recursive(&vault_dir, &vault_dir, &mut decisions);
    update_decision_registry_file(&vault_dir, &decisions);
    Ok(decisions)
}

#[tauri::command]
fn get_decision_registry(app: AppHandle) -> Result<DecisionRegistry, String> {
    let vault_dir = get_vault_path(&app)?;
    let mut decisions = Vec::new();
    scan_decisions_recursive(&vault_dir, &vault_dir, &mut decisions);
    update_decision_registry_file(&vault_dir, &decisions);

    let registry_file = vault_dir.join(".attachments").join("decision_metadata.json");
    if registry_file.exists() {
        if let Ok(content) = fs::read_to_string(registry_file) {
            if let Ok(reg) = serde_json::from_str::<DecisionRegistry>(&content) {
                return Ok(reg);
            }
        }
    }

    Ok(DecisionRegistry::default())
}

#[tauri::command]
fn update_decision_metadata(
    app: AppHandle,
    note_id: String,
    line_number: usize,
    content: String,
    description: Option<String>,
    date: Option<String>,
    status: Option<String>,
    participants: Vec<String>,
    approved_by: Vec<String>,
    tags: Vec<String>,
) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let note_path = resolve_note_path(&vault_dir, &note_id);

    if !note_path.exists() {
        return Err("Note not found".to_string());
    }

    let file_content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

    if line_number < lines.len() {
        let indent = lines[line_number]
            .chars()
            .take_while(|c| c.is_whitespace())
            .collect::<String>();
        
        let meta = DecisionMeta {
            description: if description.as_ref().map_or(true, |s| s.trim().is_empty()) { None } else { description },
            date,
            status,
            participants,
            approved_by,
            tags,
        };

        let json_meta = serde_json::to_string(&meta).unwrap_or_default();
        let new_line = format!("{}- [D] {} <!-- decision:{} -->", indent, content, json_meta);

        lines[line_number] = new_line;
        let new_content = lines.join("\n");
        fs::write(note_path, new_content).map_err(|e| e.to_string())?;
    }

    let mut decisions = Vec::new();
    scan_decisions_recursive(&vault_dir, &vault_dir, &mut decisions);
    update_decision_registry_file(&vault_dir, &decisions);

    Ok(())
}

// ─── Git Versioning & Sync Commands ────────────────────────────────────────

use std::process::Command;

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct GitCommitDto {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub timestamp: i64,
    pub message: String,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct GitStatusDto {
    #[serde(rename = "isInitialized")]
    pub is_initialized: bool,
    pub branch: String,
    #[serde(rename = "modifiedFiles")]
    pub modified_files: Vec<String>,
    #[serde(rename = "untrackedFiles")]
    pub untracked_files: Vec<String>,
    #[serde(rename = "stagedFiles")]
    pub staged_files: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
    #[serde(rename = "lastCommit")]
    pub last_commit: Option<GitCommitDto>,
    #[serde(rename = "remoteUrl")]
    pub remote_url: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct GitSyncResultDto {
    pub success: bool,
    pub message: String,
    #[serde(rename = "updatedFiles")]
    pub updated_files: Option<Vec<String>>,
    pub conflict: Option<bool>,
}

fn run_git(vault_dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(vault_dir)
        .args(args)
        .output()
        .map_err(|e| format!("Git komutu çalıştırılamadı: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let out = String::from_utf8_lossy(&output.stdout).to_string();
        let combined = if err.trim().is_empty() { out } else { err };
        return Err(combined.trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_status(app: AppHandle) -> Result<GitStatusDto, String> {
    let vault_dir = get_vault_path(&app)?;
    let git_dir = vault_dir.join(".git");

    if !git_dir.exists() {
        return Ok(GitStatusDto {
            is_initialized: false,
            ..Default::default()
        });
    }

    let branch = run_git(&vault_dir, &["branch", "--show-current"])
        .unwrap_or_else(|_| "main".to_string())
        .trim()
        .to_string();

    let remote_url = run_git(&vault_dir, &["remote", "get-url", "origin"])
        .ok()
        .map(|s| s.trim().to_string());

    let mut modified_files = Vec::new();
    let mut untracked_files = Vec::new();
    let mut staged_files = Vec::new();

    if let Ok(status_out) = run_git(&vault_dir, &["status", "--porcelain"]) {
        for line in status_out.lines() {
            if line.len() < 3 {
                continue;
            }
            let index_st = &line[0..1];
            let work_st = &line[1..2];
            let path = line[3..].trim().to_string();

            if index_st == "?" || work_st == "?" {
                untracked_files.push(path);
            } else {
                if index_st != " " && index_st != "?" {
                    staged_files.push(path.clone());
                }
                if work_st != " " && work_st != "?" {
                    modified_files.push(path);
                }
            }
        }
    }

    let last_commit = run_git(
        &vault_dir,
        &["log", "-1", "--format=%H|%h|%an|%ae|%aI|%ct|%s"],
    )
    .ok()
    .and_then(|out| {
        let parts: Vec<&str> = out.trim().split('|').collect();
        if parts.len() >= 7 {
            Some(GitCommitDto {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                email: parts[3].to_string(),
                date: parts[4].to_string(),
                timestamp: parts[5].parse::<i64>().unwrap_or(0) * 1000,
                message: parts[6..].join("|"),
            })
        } else {
            None
        }
    });

    let (ahead, behind) = if let Ok(counts) = run_git(&vault_dir, &["rev-list", "--left-right", "--count", "HEAD...@{u}"]) {
        let parts: Vec<&str> = counts.trim().split_whitespace().collect();
        if parts.len() >= 2 {
            (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
        } else {
            (0, 0)
        }
    } else {
        (0, 0)
    };

    Ok(GitStatusDto {
        is_initialized: true,
        branch: if branch.is_empty() { "main".to_string() } else { branch },
        modified_files,
        untracked_files,
        staged_files,
        ahead,
        behind,
        last_commit,
        remote_url,
    })
}

#[tauri::command]
fn git_init(app: AppHandle) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    run_git(&vault_dir, &["init"])?;
    let _ = run_git(&vault_dir, &["checkout", "-b", "main"]);
    let _ = run_git(&vault_dir, &["add", "-A"]);
    let _ = run_git(&vault_dir, &["commit", "-m", "İlk yerel versiyon (Initial commit)"]);
    Ok(())
}

#[tauri::command]
fn git_commit(app: AppHandle, message: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    run_git(&vault_dir, &["add", "-A"])?;
    if let Ok(st) = run_git(&vault_dir, &["status", "--porcelain"]) {
        if st.trim().is_empty() {
            let hash = run_git(&vault_dir, &["rev-parse", "HEAD"]).unwrap_or_default();
            return Ok(hash.trim().to_string());
        }
    }
    run_git(&vault_dir, &["commit", "-m", &message])?;
    let hash = run_git(&vault_dir, &["rev-parse", "HEAD"])?;
    Ok(hash.trim().to_string())
}

#[tauri::command]
fn git_log(app: AppHandle, file_path: Option<String>, limit: Option<usize>) -> Result<Vec<GitCommitDto>, String> {
    let vault_dir = get_vault_path(&app)?;
    let limit_num = limit.unwrap_or(50).to_string();
    let mut args = vec!["log", "-n", &limit_num, "--format=%H|%h|%an|%ae|%aI|%ct|%s"];

    let target_path;
    if let Some(ref fp) = file_path {
        target_path = if fp.ends_with(".md") { fp.clone() } else { format!("{}.md", fp) };
        args.push("--");
        args.push(&target_path);
    }

    let out = run_git(&vault_dir, &args).unwrap_or_default();
    let mut commits = Vec::new();

    for line in out.lines() {
        let parts: Vec<&str> = line.trim().split('|').collect();
        if parts.len() >= 7 {
            commits.push(GitCommitDto {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                email: parts[3].to_string(),
                date: parts[4].to_string(),
                timestamp: parts[5].parse::<i64>().unwrap_or(0) * 1000,
                message: parts[6..].join("|"),
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
fn git_diff(app: AppHandle, file_path: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let target_path = if file_path.ends_with(".md") { file_path } else { format!("{}.md", file_path) };
    run_git(&vault_dir, &["diff", "HEAD", "--", &target_path])
}

#[tauri::command]
fn git_show(app: AppHandle, file_path: String, commit_hash: String) -> Result<String, String> {
    let vault_dir = get_vault_path(&app)?;
    let target_path = if file_path.ends_with(".md") { file_path } else { format!("{}.md", file_path) };
    let spec = format!("{}:{}", commit_hash, target_path);
    run_git(&vault_dir, &["show", &spec])
}

#[tauri::command]
fn git_revert_file(app: AppHandle, file_path: String, commit_hash: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let target_path = if file_path.ends_with(".md") { file_path.clone() } else { format!("{}.md", file_path) };
    run_git(&vault_dir, &["checkout", &commit_hash, "--", &target_path])?;
    let short_hash = if commit_hash.len() > 7 { &commit_hash[..7] } else { &commit_hash };
    let _ = run_git(&vault_dir, &["commit", "-m", &format!("Geri yüklendi ({}): {}", short_hash, target_path)]);
    Ok(())
}

#[tauri::command]
fn git_remote_get(app: AppHandle) -> Result<Option<String>, String> {
    let vault_dir = get_vault_path(&app)?;
    Ok(run_git(&vault_dir, &["remote", "get-url", "origin"]).ok().map(|s| s.trim().to_string()))
}

#[tauri::command]
fn git_remote_set(app: AppHandle, url: String) -> Result<(), String> {
    let vault_dir = get_vault_path(&app)?;
    let has_origin = run_git(&vault_dir, &["remote", "get-url", "origin"]).is_ok();
    if has_origin {
        run_git(&vault_dir, &["remote", "set-url", "origin", &url])?;
    } else {
        run_git(&vault_dir, &["remote", "add", "origin", &url])?;
    }
    Ok(())
}

#[tauri::command]
fn git_pull(app: AppHandle) -> Result<GitSyncResultDto, String> {
    let vault_dir = get_vault_path(&app)?;
    let branch = run_git(&vault_dir, &["branch", "--show-current"]).unwrap_or_else(|_| "main".to_string()).trim().to_string();
    
    match run_git(&vault_dir, &["pull", "--rebase", "origin", &branch]) {
        Ok(out) => Ok(GitSyncResultDto {
            success: true,
            message: out.trim().to_string(),
            updated_files: None,
            conflict: Some(false),
        }),
        Err(err) => {
            let has_conflict = err.contains("CONFLICT") || err.contains("conflict");
            Ok(GitSyncResultDto {
                success: false,
                message: err,
                updated_files: None,
                conflict: Some(has_conflict),
            })
        }
    }
}

#[tauri::command]
fn git_push(app: AppHandle) -> Result<GitSyncResultDto, String> {
    let vault_dir = get_vault_path(&app)?;
    let branch = run_git(&vault_dir, &["branch", "--show-current"]).unwrap_or_else(|_| "main".to_string()).trim().to_string();
    
    match run_git(&vault_dir, &["push", "-u", "origin", &branch]) {
        Ok(out) => Ok(GitSyncResultDto {
            success: true,
            message: out.trim().to_string(),
            updated_files: None,
            conflict: Some(false),
        }),
        Err(err) => Ok(GitSyncResultDto {
            success: false,
            message: err,
            updated_files: None,
            conflict: Some(false),
        }),
    }
}
