use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use regex::Regex;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteInfo {
    pub id: String,
    pub title: String,
    pub path: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TagCount {
    pub tag: String,
    pub count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct NoteMetadata {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

pub fn parse_yaml_frontmatter(content: &str) -> (NoteMetadata, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (NoteMetadata::default(), content.to_string());
    }

    let after_first = &trimmed[3..];
    if let Some(end_idx) = after_first.find("\n---") {
        let yaml_str = &after_first[..end_idx];
        let body = after_first[end_idx + 4..].trim_start_matches('\n').trim_start_matches('\r').to_string();

        let mut tags = Vec::new();
        let mut extra = BTreeMap::new();

        let mut in_tags = false;
        for line in yaml_str.lines() {
            let l_trim = line.trim();
            if l_trim.is_empty() || l_trim.starts_with('#') {
                continue;
            }

            if l_trim.starts_with("tags:") {
                in_tags = true;
                let rest = l_trim["tags:".len()..].trim();
                if rest.starts_with('[') && rest.ends_with(']') {
                    let inner = &rest[1..rest.len() - 1];
                    for t in inner.split(',') {
                        let clean = t.trim().trim_matches('"').trim_matches('\'').trim_start_matches('#');
                        if !clean.is_empty() {
                            tags.push(clean.to_string());
                        }
                    }
                    in_tags = false;
                }
            } else if in_tags && l_trim.starts_with('-') {
                let tag_val = l_trim[1..].trim().trim_matches('"').trim_matches('\'').trim_start_matches('#');
                if !tag_val.is_empty() {
                    tags.push(tag_val.to_string());
                }
            } else if let Some(colon_idx) = l_trim.find(':') {
                in_tags = false;
                let key = l_trim[..colon_idx].trim().to_string();
                let val_str = l_trim[colon_idx + 1..].trim();
                if !key.is_empty() && key != "tags" {
                    extra.insert(key, serde_json::Value::String(val_str.to_string()));
                }
            }
        }

        return (NoteMetadata { tags, extra }, body);
    }

    (NoteMetadata::default(), content.to_string())
}

pub fn inject_yaml_frontmatter(metadata: &NoteMetadata, body_content: &str) -> String {
    let mut yaml_lines = Vec::new();
    yaml_lines.push("---".to_string());
    
    if !metadata.tags.is_empty() {
        yaml_lines.push("tags:".to_string());
        for t in &metadata.tags {
            yaml_lines.push(format!("  - {}", t));
        }
    }

    for (k, v) in &metadata.extra {
        if k == "tags" { continue; }
        if let Some(s) = v.as_str() {
            yaml_lines.push(format!("{}: {}", k, s));
        } else {
            yaml_lines.push(format!("{}: {}", k, v));
        }
    }

    yaml_lines.push("---".to_string());

    if metadata.tags.is_empty() && metadata.extra.is_empty() {
        body_content.to_string()
    } else {
        format!("{}\n\n{}", yaml_lines.join("\n"), body_content.trim_start())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TaskMeta {
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    #[serde(default)]
    pub assignees: Vec<String>,
    pub progress: Option<u8>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TaskInfo {
    pub note_id: String,
    pub line_number: usize,
    pub content: String,
    pub completed: bool,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    pub assignees: Vec<String>,
    pub progress: Option<u8>,
    pub tags: Vec<String>,
    pub raw_line: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TaskRegistry {
    pub assignees: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BacklinkInfo {
    pub source_note_id: String,
    pub snippet: String,
    pub line_number: usize,
}

#[inline]
pub fn path_to_note_id(rel_path: &str) -> String {
    rel_path.strip_suffix(".md").unwrap_or(rel_path).to_string()
}

pub fn collect_comma_separated<'a, I: IntoIterator<Item = &'a str>>(sources: I) -> BTreeSet<String> {
    let mut set = BTreeSet::new();
    for s in sources {
        for part in s.split(',') {
            let clean = part.trim();
            if !clean.is_empty() {
                set.insert(clean.to_string());
            }
        }
    }
    set
}

pub fn parse_task_line(line: &str) -> Option<(bool, String, TaskMeta)> {
    let re = Regex::new(r"^\s*[-*+]\s*\[([ xX])\]\s*(.*)").ok()?;
    let caps = re.captures(line)?;
    let completed = &caps[1] != " ";
    let raw_text = caps[2].to_string();

    if raw_text.trim().is_empty() {
        return None;
    }

    let mut meta = TaskMeta::default();

    let text_without_comment = if let Some(idx) = raw_text.find("<!-- task:") {
        let comment_part = &raw_text[idx + 10..];
        if let Some(end_idx) = comment_part.find("-->") {
            let json_str = comment_part[..end_idx].trim();
            if let Ok(parsed) = serde_json::from_str::<TaskMeta>(json_str) {
                meta = parsed;
            }
        }
        raw_text[..idx].trim().to_string()
    } else {
        raw_text.trim().to_string()
    };

    let clean_assignees_set = collect_comma_separated(
        meta.assignees.iter().map(|s| s.as_str()).chain(
            meta.assignee.iter().map(|s| s.as_str())
        )
    );

    meta.assignees = clean_assignees_set.into_iter().collect();

    Some((completed, text_without_comment, meta))
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DecisionMeta {
    pub description: Option<String>,
    pub date: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub participants: Vec<String>,
    #[serde(default)]
    pub approved_by: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DecisionInfo {
    pub note_id: String,
    pub line_number: usize,
    pub content: String,
    pub description: Option<String>,
    pub date: Option<String>,
    pub status: Option<String>,
    pub participants: Vec<String>,
    pub approved_by: Vec<String>,
    pub tags: Vec<String>,
    pub raw_line: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DecisionRegistry {
    pub participants: Vec<String>,
    pub approved_by: Vec<String>,
    pub tags: Vec<String>,
}

pub fn parse_decision_line(line: &str) -> Option<(String, DecisionMeta)> {
    let trimmed = line.trim();
    if !trimmed.starts_with("- [D]") && !trimmed.starts_with("- [d]") && !trimmed.contains("<!-- decision:") {
        return None;
    }

    let mut raw_text = trimmed.to_string();
    if raw_text.starts_with("- [D]") || raw_text.starts_with("- [d]") {
        raw_text = raw_text[5..].trim().to_string();
    }

    let meta = if let Some(idx) = raw_text.find("<!-- decision:") {
        let json_part = &raw_text[idx + 14..];
        let end_idx = json_part.find("-->").unwrap_or(json_part.len());
        let json_str = json_part[..end_idx].trim();
        serde_json::from_str::<DecisionMeta>(json_str).unwrap_or_default()
    } else {
        DecisionMeta::default()
    };

    let content = if let Some(idx) = raw_text.find("<!-- decision:") {
        raw_text[..idx].trim().to_string()
    } else {
        raw_text.trim().to_string()
    };

    if content.is_empty() {
        return None;
    }

    Some((content, meta))
}

// WASM Bindings

#[wasm_bindgen]
pub fn wasm_parse_yaml_frontmatter(content: &str) -> JsValue {
    let (meta, body) = parse_yaml_frontmatter(content);
    serde_wasm_bindgen::to_value(&(meta, body)).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn wasm_inject_yaml_frontmatter(metadata_json: &str, body: &str) -> String {
    let metadata = serde_json::from_str::<NoteMetadata>(metadata_json).unwrap_or_default();
    inject_yaml_frontmatter(&metadata, body)
}

#[wasm_bindgen]
pub fn wasm_parse_tasks_from_content(content: &str, note_id: &str) -> JsValue {
    let mut tasks = Vec::new();
    for (i, line) in content.lines().enumerate() {
        if let Some((completed, display_text, meta)) = parse_task_line(line) {
            tasks.push(TaskInfo {
                note_id: note_id.to_string(),
                line_number: i,
                content: display_text,
                completed,
                description: meta.description,
                start_date: meta.start_date,
                end_date: meta.end_date,
                priority: meta.priority,
                assignee: meta.assignee,
                assignees: meta.assignees,
                progress: meta.progress,
                tags: meta.tags,
                raw_line: line.to_string(),
            });
        }
    }
    serde_wasm_bindgen::to_value(&tasks).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn wasm_parse_decisions_from_content(content: &str, note_id: &str) -> JsValue {
    let mut decisions = Vec::new();
    for (i, line) in content.lines().enumerate() {
        if let Some((display_text, meta)) = parse_decision_line(line) {
            decisions.push(DecisionInfo {
                note_id: note_id.to_string(),
                line_number: i,
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
    serde_wasm_bindgen::to_value(&decisions).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn wasm_find_backlinks(content: &str, source_note_id: &str, target_note_id: &str) -> JsValue {
    let mut backlinks = Vec::new();
    let title_stem = target_note_id.split('/').last().unwrap_or(target_note_id);
    
    let pattern = format!(
        r"\[\[(?:{}|{})\s*(?:\|[^\]]*)?\]\]",
        regex::escape(target_note_id),
        regex::escape(title_stem)
    );
    
    if let Ok(re) = Regex::new(&pattern) {
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                backlinks.push(BacklinkInfo {
                    source_note_id: source_note_id.to_string(),
                    snippet: line.trim().to_string(),
                    line_number: i,
                });
            }
        }
    }
    
    serde_wasm_bindgen::to_value(&backlinks).unwrap_or(JsValue::NULL)
}
