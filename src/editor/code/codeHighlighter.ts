/**
 * codeHighlighter.ts — Fast, asynchronous syntax highlighter for Preview Mode Code Blocks.
 * Uses @lezer/highlight and @codemirror/language-data to produce syntax-highlighted HTML.
 */
import { highlightTree, tags, tagHighlighter } from "@lezer/highlight";
import { languages } from "@codemirror/language-data";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const highlighter = tagHighlighter([
  { tag: tags.keyword, class: "cm-tok-keyword" },
  { tag: tags.controlKeyword, class: "cm-tok-keyword" },
  { tag: tags.moduleKeyword, class: "cm-tok-keyword" },
  { tag: tags.operatorKeyword, class: "cm-tok-keyword" },
  { tag: tags.definitionKeyword, class: "cm-tok-keyword" },
  { tag: tags.string, class: "cm-tok-string" },
  { tag: tags.special(tags.string), class: "cm-tok-string" },
  { tag: tags.number, class: "cm-tok-number" },
  { tag: tags.bool, class: "cm-tok-bool" },
  { tag: tags.null, class: "cm-tok-bool" },
  { tag: tags.comment, class: "cm-tok-comment" },
  { tag: tags.lineComment, class: "cm-tok-comment" },
  { tag: tags.blockComment, class: "cm-tok-comment" },
  { tag: tags.docComment, class: "cm-tok-comment" },
  { tag: tags.variableName, class: "cm-tok-variable" },
  { tag: tags.function(tags.variableName), class: "cm-tok-function" },
  { tag: tags.function(tags.definition(tags.variableName)), class: "cm-tok-function" },
  { tag: tags.typeName, class: "cm-tok-type" },
  { tag: tags.className, class: "cm-tok-type" },
  { tag: tags.namespace, class: "cm-tok-type" },
  { tag: tags.propertyName, class: "cm-tok-property" },
  { tag: tags.operator, class: "cm-tok-operator" },
  { tag: tags.punctuation, class: "cm-tok-punctuation" },
  { tag: tags.bracket, class: "cm-tok-bracket" },
  { tag: tags.tagName, class: "cm-tok-tag" },
  { tag: tags.attributeName, class: "cm-tok-attr" },
  { tag: tags.attributeValue, class: "cm-tok-string" },
  { tag: tags.self, class: "cm-tok-keyword" },
  { tag: tags.regexp, class: "cm-tok-string" },
]);

const HIGHLIGHT_CACHE = new Map<string, string>();
const MAX_CACHE_ENTRIES = 200;

export async function highlightCodeToHtml(code: string, lang: string): Promise<string> {
  const cleanLang = (lang || "").toLowerCase().trim();
  const cacheKey = `${cleanLang}:::${code}`;

  if (HIGHLIGHT_CACHE.has(cacheKey)) {
    return HIGHLIGHT_CACHE.get(cacheKey)!;
  }

  const lines = code.split("\n");
  const fallbackHtml = lines.map((l) => escapeHtml(l) || "&nbsp;").join("<br/>");

  if (!cleanLang || cleanLang === "plaintext" || cleanLang === "txt" || cleanLang === "text") {
    return fallbackHtml;
  }

  const langDesc = languages.find(
    (l) =>
      l.name.toLowerCase() === cleanLang ||
      l.alias.some((a) => a.toLowerCase() === cleanLang) ||
      l.extensions.some((ext) => ext.toLowerCase() === cleanLang)
  );

  if (!langDesc) {
    return fallbackHtml;
  }

  try {
    const support = await langDesc.load();
    const parser = support.language?.parser;
    if (!parser) return fallbackHtml;

    const tree = parser.parse(code);
    let result = "";
    let pos = 0;

    highlightTree(tree, highlighter, (from, to, classes) => {
      if (from > pos) {
        result += escapeHtml(code.slice(pos, from));
      }
      const chunk = escapeHtml(code.slice(from, to));
      if (classes) {
        result += `<span class="${classes}">${chunk}</span>`;
      } else {
        result += chunk;
      }
      pos = to;
    });

    if (pos < code.length) {
      result += escapeHtml(code.slice(pos));
    }

    const htmlLines = result.split("\n").map((line) => line || "&nbsp;").join("<br/>");

    if (HIGHLIGHT_CACHE.size >= MAX_CACHE_ENTRIES) {
      const firstKey = HIGHLIGHT_CACHE.keys().next().value;
      if (firstKey) HIGHLIGHT_CACHE.delete(firstKey);
    }
    HIGHLIGHT_CACHE.set(cacheKey, htmlLines);

    return htmlLines;
  } catch (err) {
    console.warn(`[codeHighlighter] Failed to highlight code for ${cleanLang}:`, err);
    return fallbackHtml;
  }
}
