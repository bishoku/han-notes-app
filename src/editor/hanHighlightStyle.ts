/**
 * hanHighlightStyle.ts — Rich syntax highlighting theme for code blocks.
 * Inspired by VS Code Dark+ / GitHub Light with high contrast tokens.
 * Replaces the default CodeMirror highlighting with more vibrant colors.
 */
import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const hanHighlightStyle = HighlightStyle.define([
  // Keywords: if, else, return, const, let, var, function, class, import, export, etc.
  { tag: tags.keyword, color: '#8b5cf6', fontWeight: '600' },
  { tag: tags.controlKeyword, color: '#8b5cf6', fontWeight: '600' },
  { tag: tags.moduleKeyword, color: '#8b5cf6', fontWeight: '600' },
  { tag: tags.operatorKeyword, color: '#8b5cf6', fontWeight: '600' },
  { tag: tags.definitionKeyword, color: '#8b5cf6', fontWeight: '600' },

  // Strings
  { tag: tags.string, color: '#059669' },
  { tag: tags.special(tags.string), color: '#0d9488' },

  // Numbers & Booleans
  { tag: tags.number, color: '#0284c7' },
  { tag: tags.bool, color: '#d97706', fontWeight: '600' },
  { tag: tags.null, color: '#d97706', fontWeight: '600' },

  // Functions
  { tag: tags.function(tags.variableName), color: '#2563eb' },
  { tag: tags.function(tags.definition(tags.variableName)), color: '#2563eb', fontWeight: '600' },

  // Types & Classes
  { tag: tags.typeName, color: '#0891b2' },
  { tag: tags.className, color: '#0891b2', fontWeight: '600' },
  { tag: tags.namespace, color: '#0891b2' },

  // Variables & Properties
  { tag: tags.variableName, color: '#334155' },
  { tag: tags.definition(tags.variableName), color: '#1e40af' },
  { tag: tags.propertyName, color: '#0369a1' },
  { tag: tags.definition(tags.propertyName), color: '#0369a1' },

  // Operators & Punctuation
  { tag: tags.operator, color: '#be185d' },
  { tag: tags.punctuation, color: '#64748b' },
  { tag: tags.bracket, color: '#64748b' },
  { tag: tags.separator, color: '#64748b' },

  // Comments
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#94a3b8', fontStyle: 'italic' },

  // Tags (HTML/JSX)
  { tag: tags.tagName, color: '#dc2626' },
  { tag: tags.attributeName, color: '#d97706' },
  { tag: tags.attributeValue, color: '#059669' },

  // Special
  { tag: tags.self, color: '#8b5cf6', fontStyle: 'italic' },
  { tag: tags.regexp, color: '#ea580c' },
  { tag: tags.escape, color: '#ea580c', fontWeight: '600' },
  { tag: tags.meta, color: '#6366f1' },
  { tag: tags.annotation, color: '#6366f1' },
]);

// Dark mode variant
export const hanHighlightStyleDark = HighlightStyle.define([
  // Keywords
  { tag: tags.keyword, color: '#c084fc', fontWeight: '600' },
  { tag: tags.controlKeyword, color: '#c084fc', fontWeight: '600' },
  { tag: tags.moduleKeyword, color: '#c084fc', fontWeight: '600' },
  { tag: tags.operatorKeyword, color: '#c084fc', fontWeight: '600' },
  { tag: tags.definitionKeyword, color: '#c084fc', fontWeight: '600' },

  // Strings
  { tag: tags.string, color: '#34d399' },
  { tag: tags.special(tags.string), color: '#2dd4bf' },

  // Numbers & Booleans
  { tag: tags.number, color: '#38bdf8' },
  { tag: tags.bool, color: '#fbbf24', fontWeight: '600' },
  { tag: tags.null, color: '#fbbf24', fontWeight: '600' },

  // Functions
  { tag: tags.function(tags.variableName), color: '#60a5fa' },
  { tag: tags.function(tags.definition(tags.variableName)), color: '#60a5fa', fontWeight: '600' },

  // Types & Classes
  { tag: tags.typeName, color: '#22d3ee' },
  { tag: tags.className, color: '#22d3ee', fontWeight: '600' },
  { tag: tags.namespace, color: '#22d3ee' },

  // Variables & Properties
  { tag: tags.variableName, color: '#e2e8f0' },
  { tag: tags.definition(tags.variableName), color: '#93c5fd' },
  { tag: tags.propertyName, color: '#7dd3fc' },
  { tag: tags.definition(tags.propertyName), color: '#7dd3fc' },

  // Operators & Punctuation
  { tag: tags.operator, color: '#f472b6' },
  { tag: tags.punctuation, color: '#94a3b8' },
  { tag: tags.bracket, color: '#94a3b8' },
  { tag: tags.separator, color: '#94a3b8' },

  // Comments
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#64748b', fontStyle: 'italic' },

  // Tags (HTML/JSX)
  { tag: tags.tagName, color: '#f87171' },
  { tag: tags.attributeName, color: '#fbbf24' },
  { tag: tags.attributeValue, color: '#34d399' },

  // Special
  { tag: tags.self, color: '#c084fc', fontStyle: 'italic' },
  { tag: tags.regexp, color: '#fb923c' },
  { tag: tags.escape, color: '#fb923c', fontWeight: '600' },
  { tag: tags.meta, color: '#818cf8' },
  { tag: tags.annotation, color: '#818cf8' },
]);
