/**
 * lineParser.ts — Markdown satırlarından task ve decision metadata'sı çıkaran yardımcı fonksiyonlar.
 * MainEditor, TasksView, DecisionsView gibi bileşenlerden ortak kullanılır.
 */

// ─── Common helper ───────────────────────────────────────────────────────────

/**
 * Extracts an HTML comment with a given prefix from raw text.
 * Returns the parsed JSON metadata and cleaned content string.
 * 
 * @example extractCommentMetadata("Buy milk <!-- task:{\"priority\":\"high\"} -->", "task")
 * // → { metadata: { priority: "high" }, content: "Buy milk" }
 */
function extractCommentMetadata(rawText: string, prefix: string): { metadata: Record<string, any>; content: string } {
  const re = new RegExp(`<!--\\s*${prefix}:(.*?)-->`)
  const match = rawText.match(re);

  if (!match) {
    return { metadata: {}, content: rawText.trim() };
  }

  let metadata: Record<string, any> = {};
  try {
    metadata = JSON.parse(match[1].trim());
  } catch {
    // Malformed JSON — silently ignore
  }

  const content = rawText.replace(match[0], '').trim();
  return { metadata, content };
}

// ─── Task Parser ─────────────────────────────────────────────────────────────

export interface ParsedTask {
  completed: boolean;
  content: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string | null;
  assignee: string | null;
  assignees: string[];
  progress: number;
  tags: string[];
}

/**
 * Parses a markdown task line (e.g. `- [x] Buy milk <!-- task:{...} -->`)
 * into a structured object. Returns null if the line isn't a valid task.
 */
export function parseTaskLineText(lineText: string): ParsedTask | null {
  const match = lineText.match(/^\s*-\s*\[([ xX])\]\s+(.*)/);
  if (!match) return null;

  const completed = match[1] !== ' ';
  const { metadata, content } = extractCommentMetadata(match[2], 'task');

  const assignees = Array.isArray(metadata.assignees) && metadata.assignees.length > 0
    ? metadata.assignees
    : (metadata.assignee ? [metadata.assignee] : []);

  return {
    completed,
    content,
    description: metadata.description || null,
    startDate: metadata.start_date || null,
    endDate: metadata.end_date || null,
    priority: metadata.priority || null,
    assignee: metadata.assignee || null,
    assignees,
    progress: metadata.progress ?? (completed ? 100 : 0),
    tags: metadata.tags || [],
  };
}

// ─── Decision Parser ─────────────────────────────────────────────────────────

export interface ParsedDecision {
  content: string;
  description: string | null;
  date: string | null;
  status: string;
  participants: string[];
  approvedBy: string[];
  tags: string[];
}

/**
 * Parses a markdown decision line (e.g. `- [D] Decision text <!-- decision:{...} -->`)
 * into a structured object.
 */
export function parseDecisionLineText(lineText: string): ParsedDecision {
  const match = lineText.match(/^\s*-\s*\[[Dd]\]\s+(.*)/);
  let rawText = match ? match[1] : lineText.trim();

  // Legacy fallback: in case the raw text still starts with `- [D]`
  if (rawText.startsWith('- [D]') || rawText.startsWith('- [d]')) {
    rawText = rawText.slice(5).trim();
  }

  const { metadata, content } = extractCommentMetadata(rawText, 'decision');

  return {
    content,
    description: metadata.description || null,
    date: metadata.date || null,
    status: metadata.status || 'approved',
    participants: metadata.participants || [],
    approvedBy: metadata.approved_by || [],
    tags: metadata.tags || [],
  };
}

/**
 * Parses frontmatter tags from raw markdown content without needing full file parser.
 */
export function extractTagsFromFrontmatter(content: string): string[] {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return [];
  const afterFirst = trimmed.slice(3);
  const endIdx = afterFirst.indexOf("\n---");
  if (endIdx === -1) return [];
  const yamlStr = afterFirst.slice(0, endIdx);

  const tags: string[] = [];
  let inTags = false;

  for (const line of yamlStr.split("\n")) {
    const l = line.trim();
    if (l.startsWith("tags:")) {
      inTags = true;
      const rest = l.slice(5).trim();
      if (rest.startsWith("[") && rest.endsWith("]")) {
        const inner = rest.slice(1, -1);
        inner.split(",").forEach((t) => {
          const clean = t.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
          if (clean) tags.push(clean);
        });
        inTags = false;
      }
    } else if (inTags && l.startsWith("-")) {
      const clean = l.slice(1).trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
      if (clean) tags.push(clean);
    } else if (l.includes(":")) {
      inTags = false;
    }
  }

  return tags;
}
