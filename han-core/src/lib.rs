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

// ─── Reasoning & Thinking Extraction ────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ParsedReasoningOutput {
    pub reasoning: String,
    pub content: String,
    pub has_reasoning: bool,
}

/// Parses LLM output to cleanly extract reasoning/thinking blocks from the final answer.
/// Covers:
/// 1. <think>...</think>, <thought>...</thought>, <thinking>...</thinking>, <thinking_process>...</thinking_process>
/// 2. Qwen special tokens: <|thought|>...<|/thought|>, <|thought|>...<|endofthought|>, <|im_start|>thought\n...<|im_end|>
/// 3. Markdown codeblocks: ```thought\n...\n```, ```thinking\n...\n```
/// 4. Implicit start tags where prompt prefill emitted <think>, so stream only has </think>
pub fn parse_reasoning_blocks(raw: &str) -> ParsedReasoningOutput {
    if raw.trim().is_empty() {
        return ParsedReasoningOutput::default();
    }

    let mut reasoning_parts = Vec::new();
    let mut content = raw.to_string();

    // 1. Tag pairs: (open_tag, list of possible close tags)
    let tag_specs: &[(&str, &[&str])] = &[
        ("<think>", &["</think>"]),
        ("<thought>", &["</thought>"]),
        ("<thinking>", &["</thinking>"]),
        ("<thinking_process>", &["</thinking_process>"]),
        ("<|thought|>", &["<|/thought|>", "<|endofthought|>"]),
        ("<|im_start|>thought", &["<|im_end|>"]),
        ("```thought", &["```"]),
        ("```thinking", &["```"]),
    ];

    for &(open_tag, close_tags) in tag_specs.iter() {
        while let Some(start_idx) = content.find(open_tag) {
            let inner_start = start_idx + open_tag.len();
            
            // Find earliest matching close tag
            let mut earliest_close: Option<(usize, &str)> = None;
            for &close_tag in close_tags.iter() {
                if let Some(pos) = content[inner_start..].find(close_tag) {
                    if earliest_close.map_or(true, |(min_pos, _)| pos < min_pos) {
                        earliest_close = Some((pos, close_tag));
                    }
                }
            }

            if let Some((rel_pos, matched_close_tag)) = earliest_close {
                let inner_end = inner_start + rel_pos;
                let thought_text = content[inner_start..inner_end].trim().to_string();
                if !thought_text.is_empty() {
                    reasoning_parts.push(thought_text);
                }
                let before = &content[..start_idx];
                let after = &content[inner_end + matched_close_tag.len()..];
                content = format!("{}{}", before, after);
            } else {
                // Unclosed opening tag (still streaming or model truncated)
                let thought_text = content[inner_start..].trim().to_string();
                if !thought_text.is_empty() {
                    reasoning_parts.push(thought_text);
                }
                content = content[..start_idx].to_string();
                break;
            }
        }
    }

    // 2. Implicit opening tag case (Prompt prefill contained `<think>`, so model started directly and only closed with `</think>` or `<|/thought|>`)
    let close_only_tags = ["</think>", "</thought>", "</thinking>", "</thinking_process>", "<|/thought|>", "<|endofthought|>"];
    for close_tag in close_only_tags.iter() {
        if let Some(close_idx) = content.find(close_tag) {
            let thought_text = content[..close_idx].trim().to_string();
            if !thought_text.is_empty() {
                reasoning_parts.push(thought_text);
            }
            content = content[close_idx + close_tag.len()..].to_string();
        }
    }

    // 3. Clean remaining stray tokens or trailing whitespace
    content = content.trim().to_string();
    let reasoning = reasoning_parts.join("\n\n---\n\n").trim().to_string();
    let has_reasoning = !reasoning.is_empty();

    ParsedReasoningOutput {
        reasoning,
        content,
        has_reasoning,
    }
}

#[wasm_bindgen]
pub fn wasm_parse_reasoning(raw: &str) -> JsValue {
    let result = parse_reasoning_blocks(raw);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn wasm_strip_reasoning(raw: &str) -> String {
    let result = parse_reasoning_blocks(raw);
    result.content
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WasmPdfTextItem {
    pub str: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug)]
struct FormattedLine {
    text: String,
    font_size: f64,
    is_heading: bool,
    heading_level: usize,
}

#[wasm_bindgen]
pub fn wasm_process_pdf_page_layout(
    items_json: &str,
    page_width: f64,
    _page_height: f64,
    body_font_size: f64,
) -> String {
    let items: Vec<WasmPdfTextItem> = match serde_json::from_str(items_json) {
        Ok(it) => it,
        Err(_) => return String::new(),
    };

    if items.is_empty() {
        return String::new();
    }

    let mid_x = page_width / 2.0;
    let mut left_items = Vec::new();
    let mut right_items = Vec::new();
    let mut full_width_items = Vec::new();

    // 1. Column analysis: check if items cluster into two columns
    let left_count = items.iter().filter(|i| i.x + i.width < mid_x).count();
    let right_count = items.iter().filter(|i| i.x > mid_x * 0.85).count();
    let is_two_column = items.len() > 15 && left_count > items.len() / 4 && right_count > items.len() / 4;

    let ordered_items: Vec<WasmPdfTextItem> = if is_two_column {
        for item in items {
            // Full-width title or banner (width > 60% of page)
            if item.width > page_width * 0.6 {
                full_width_items.push(item);
            } else if item.x + item.width / 2.0 < mid_x {
                left_items.push(item);
            } else {
                right_items.push(item);
            }
        }

        // Sort items top-to-bottom (y descending in PDF coordinate space)
        left_items.sort_by(|a, b| b.y.partial_cmp(&a.y).unwrap_or(std::cmp::Ordering::Equal).then_with(|| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal)));
        right_items.sort_by(|a, b| b.y.partial_cmp(&a.y).unwrap_or(std::cmp::Ordering::Equal).then_with(|| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal)));
        full_width_items.sort_by(|a, b| b.y.partial_cmp(&a.y).unwrap_or(std::cmp::Ordering::Equal));

        // Stitch: full-width banners with high y (titles at top), then left column, then right column, then remaining full-width
        let mut combined = Vec::new();
        let top_threshold = if !left_items.is_empty() { left_items[0].y + 10.0 } else { 0.0 };
        
        let mut remaining_full = Vec::new();
        for item in full_width_items {
            if item.y >= top_threshold {
                combined.push(item);
            } else {
                remaining_full.push(item);
            }
        }
        combined.extend(left_items);
        combined.extend(right_items);
        combined.extend(remaining_full);
        combined
    } else {
        let mut single = items;
        single.sort_by(|a, b| b.y.partial_cmp(&a.y).unwrap_or(std::cmp::Ordering::Equal).then_with(|| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal)));
        single
    };

    // 2. Line Grouping (group items having close Y-coordinates)
    let mut lines: Vec<FormattedLine> = Vec::new();
    let mut current_line_text = String::new();
    let mut current_y: Option<f64> = None;
    let mut current_font_size = body_font_size;

    for item in ordered_items {
        match current_y {
            None => {
                current_y = Some(item.y);
                current_line_text = item.str;
                current_font_size = item.height;
            }
            Some(prev_y) => {
                if (item.y - prev_y).abs() < current_font_size * 0.6 {
                    current_line_text.push(' ');
                    current_line_text.push_str(&item.str);
                    if item.height > current_font_size {
                        current_font_size = item.height;
                    }
                } else {
                    let trimmed = current_line_text.trim();
                    if !trimmed.is_empty() && !is_page_number_alone(trimmed) {
                        let (is_heading, level) = classify_heading(trimmed, current_font_size, body_font_size);
                        lines.push(FormattedLine {
                            text: trimmed.to_string(),
                            font_size: current_font_size,
                            is_heading,
                            heading_level: level,
                        });
                    }
                    current_y = Some(item.y);
                    current_line_text = item.str;
                    current_font_size = item.height;
                }
            }
        }
    }

    let final_trimmed = current_line_text.trim();
    if !final_trimmed.is_empty() && !is_page_number_alone(final_trimmed) {
        let (is_heading, level) = classify_heading(final_trimmed, current_font_size, body_font_size);
        lines.push(FormattedLine {
            text: final_trimmed.to_string(),
            font_size: current_font_size,
            is_heading,
            heading_level: level,
        });
    }

    // 3. Paragraph Stitching and Markdown Generation
    let mut blocks: Vec<String> = Vec::new();
    let mut current_para = String::new();

    for line in lines {
        if line.is_heading {
            if !current_para.is_empty() {
                blocks.push(current_para.trim().to_string());
                current_para.clear();
            }
            let hashes = "#".repeat(line.heading_level.min(4));
            blocks.push(format!("{} {}", hashes, line.text));
            continue;
        }

        // Bullet point check
        if line.text.starts_with('•') || line.text.starts_with('-') || line.text.starts_with('*') {
            if !current_para.is_empty() {
                blocks.push(current_para.trim().to_string());
                current_para.clear();
            }
            let clean_bullet = line.text.trim_start_matches(|c: char| c == '•' || c == '-' || c == '*').trim_start();
            blocks.push(format!("- {}", clean_bullet));
            continue;
        }

        // De-hyphenation at line ends (e.g. "inter-" + "national")
        if current_para.ends_with('-') {
            current_para.pop();
            current_para.push_str(&line.text);
        } else if !current_para.is_empty() {
            current_para.push(' ');
            current_para.push_str(&line.text);
        } else {
            current_para.push_str(&line.text);
        }

        // If line ends with sentence terminal punctuation (. ! ? :), flush paragraph
        if line.text.ends_with('.') || line.text.ends_with('!') || line.text.ends_with('?') || line.text.ends_with(':') {
            blocks.push(current_para.trim().to_string());
            current_para.clear();
        }
    }

    if !current_para.is_empty() {
        blocks.push(current_para.trim().to_string());
    }

    blocks.join("\n\n")
}

fn is_page_number_alone(s: &str) -> bool {
    let t = s.trim_matches(|c: char| c == '-' || c == '—' || c == '–' || c == ' ').trim();
    !t.is_empty() && t.chars().all(|c| c.is_ascii_digit())
}

fn classify_heading(_text: &str, font_size: f64, body_font_size: f64) -> (bool, usize) {
    if font_size >= body_font_size * 1.45 {
        (true, 1)
    } else if font_size >= body_font_size * 1.25 {
        (true, 2)
    } else if font_size >= body_font_size * 1.10 {
        (true, 3)
    } else {
        (false, 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_think_tags() {
        let input = "<think>\nAnalyzing the architecture...\n</think>\n\nHere is the final answer.";
        let res = parse_reasoning_blocks(input);
        assert_eq!(res.has_reasoning, true);
        assert_eq!(res.reasoning, "Analyzing the architecture...");
        assert_eq!(res.content, "Here is the final answer.");
    }

    #[test]
    fn test_implicit_prefill_closing_only() {
        let input = "Step 1: Check nodes.\nStep 2: Conclude.\n</think>\n\nFinal response.";
        let res = parse_reasoning_blocks(input);
        assert_eq!(res.has_reasoning, true);
        assert_eq!(res.reasoning, "Step 1: Check nodes.\nStep 2: Conclude.");
        assert_eq!(res.content, "Final response.");
    }

    #[test]
    fn test_qwen_special_tokens() {
        let input = "<|thought|>\nQwen reasoning process\n<|endofthought|>\nClean response.";
        let res = parse_reasoning_blocks(input);
        assert_eq!(res.has_reasoning, true);
        assert_eq!(res.reasoning, "Qwen reasoning process");
        assert_eq!(res.content, "Clean response.");
    }

    #[test]
    fn test_no_reasoning() {
        let input = "Regular markdown response without thinking.";
        let res = parse_reasoning_blocks(input);
        assert_eq!(res.has_reasoning, false);
        assert_eq!(res.reasoning, "");
        assert_eq!(res.content, "Regular markdown response without thinking.");
    }
}

