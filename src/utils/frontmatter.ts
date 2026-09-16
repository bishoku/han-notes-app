/**
 * Pure TypeScript frontmatter utilities.
 *
 * These bypass the WASM parse/inject roundtrip which has serialization issues
 * with serde_wasm_bindgen <-> serde_json format mismatches (particularly
 * around #[serde(flatten)] on the `extra` BTreeMap).
 *
 * For single-note operations (tag updates, timestamp injection), text-level
 * manipulation is simpler, safer, and avoids data loss.
 */

/**
 * Splits markdown content into frontmatter YAML block and body.
 * Returns [yamlContent, body]. If no frontmatter, returns ['', content].
 */
export function splitFrontmatter(content: string): [string, string] {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return ['', content];

  const afterFirst = trimmed.slice(3);
  const endIdx = afterFirst.indexOf('\n---');
  if (endIdx === -1) return ['', content];

  const yaml = afterFirst.slice(0, endIdx).trim();
  const body = afterFirst.slice(endIdx + 4); // skip '\n---'
  return [yaml, body];
}

/**
 * Parses a YAML frontmatter string into a key-value map.
 * Handles simple scalars, inline arrays [a, b], and list arrays (- item).
 * Does NOT use a full YAML parser — covers the subset used by HAN.
 */
export function parseFrontmatterFields(yaml: string): Map<string, string | string[]> {
  const fields = new Map<string, string | string[]>();
  if (!yaml) return fields;

  let currentKey = '';
  let currentList: string[] | null = null;

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();

    // List continuation: "- item"
    if (currentList !== null && trimmed.startsWith('-') && !trimmed.includes(':')) {
      const val = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '');
      if (val) currentList.push(val);
      continue;
    }

    // Flush previous list
    if (currentList !== null) {
      fields.set(currentKey, currentList);
      currentList = null;
    }

    // Key: value line
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    currentKey = key;

    if (!rawValue) {
      // Could be start of a list
      currentList = [];
      continue;
    }

    // Inline array: [a, b, c]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1);
      if (!inner.trim()) {
        fields.set(key, []);
      } else {
        const items = inner.split(',').map(s =>
          s.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '')
        ).filter(Boolean);
        fields.set(key, items);
      }
      continue;
    }

    // Simple scalar value (strip quotes)
    fields.set(key, rawValue.replace(/^['"]|['"]$/g, ''));
  }

  // Flush trailing list
  if (currentList !== null) {
    fields.set(currentKey, currentList);
  }

  return fields;
}

/**
 * Serializes a frontmatter fields map back to a YAML string.
 * Preserves OKF field ordering: title, type, description, tags, created_at, updated_at, then rest.
 */
export function serializeFrontmatter(fields: Map<string, string | string[]>): string {
  const orderedKeys = ['title', 'type', 'description', 'tags', 'created_at', 'updated_at'];
  const lines: string[] = [];

  const emitField = (key: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}: [${value.join(', ')}]`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  };

  // Emit ordered fields first
  for (const key of orderedKeys) {
    if (fields.has(key)) {
      emitField(key, fields.get(key)!);
    }
  }

  // Emit remaining fields in original order
  for (const [key, value] of fields) {
    if (!orderedKeys.includes(key)) {
      emitField(key, value);
    }
  }

  return lines.join('\n');
}

/**
 * Reassembles a full markdown document from frontmatter fields and body.
 */
export function assembleFrontmatter(fields: Map<string, string | string[]>, body: string): string {
  const yaml = serializeFrontmatter(fields);
  if (!yaml) return body;
  return `---\n${yaml}\n---${body}`;
}

/**
 * Updates specific frontmatter fields in a markdown document, preserving all others.
 * If the document has no frontmatter, creates one with the given updates.
 */
export function updateFrontmatterFields(
  content: string,
  updates: Record<string, string | string[]>
): string {
  const [yaml, body] = splitFrontmatter(content);
  const fields = parseFrontmatterFields(yaml);

  for (const [key, value] of Object.entries(updates)) {
    fields.set(key, value);
  }

  return assembleFrontmatter(fields, body);
}
