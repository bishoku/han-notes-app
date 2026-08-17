/**
 * CodeLangBadgeWidget.ts — Language badge pill for fenced code block headers.
 * Shows a colored icon/abbreviation + language name in the header bar.
 */
import { WidgetType } from '@codemirror/view';

// Language display config: abbreviation, full name, color
const LANG_CONFIG: Record<string, { abbr: string; name: string; color: string }> = {
  typescript:  { abbr: 'TS',   name: 'TypeScript',  color: '#3178c6' },
  ts:          { abbr: 'TS',   name: 'TypeScript',  color: '#3178c6' },
  javascript:  { abbr: 'JS',   name: 'JavaScript',  color: '#f7df1e' },
  js:          { abbr: 'JS',   name: 'JavaScript',  color: '#f7df1e' },
  jsx:         { abbr: 'JSX',  name: 'React JSX',   color: '#61dafb' },
  tsx:         { abbr: 'TSX',  name: 'React TSX',   color: '#61dafb' },
  python:      { abbr: 'PY',   name: 'Python',      color: '#3776ab' },
  py:          { abbr: 'PY',   name: 'Python',      color: '#3776ab' },
  html:        { abbr: '< >',  name: 'HTML',        color: '#e34f26' },
  css:         { abbr: '#',    name: 'CSS',          color: '#1572b6' },
  scss:        { abbr: '#',    name: 'SCSS',         color: '#c6538c' },
  json:        { abbr: '{ }',  name: 'JSON',        color: '#6d6d6d' },
  bash:        { abbr: '$',    name: 'Bash',         color: '#4eaa25' },
  sh:          { abbr: '$',    name: 'Shell',        color: '#4eaa25' },
  shell:       { abbr: '$',    name: 'Shell',        color: '#4eaa25' },
  sql:         { abbr: 'SQL',  name: 'SQL',          color: '#e38c00' },
  markdown:    { abbr: 'MD',   name: 'Markdown',     color: '#083fa1' },
  md:          { abbr: 'MD',   name: 'Markdown',     color: '#083fa1' },
  rust:        { abbr: 'RS',   name: 'Rust',         color: '#ce412b' },
  go:          { abbr: 'GO',   name: 'Go',           color: '#00add8' },
  java:        { abbr: 'JV',   name: 'Java',         color: '#b07219' },
  kotlin:      { abbr: 'KT',   name: 'Kotlin',       color: '#7f52ff' },
  swift:       { abbr: 'SW',   name: 'Swift',        color: '#fa7343' },
  ruby:        { abbr: 'RB',   name: 'Ruby',         color: '#cc342d' },
  php:         { abbr: 'PHP',  name: 'PHP',          color: '#777bb4' },
  csharp:      { abbr: 'C#',   name: 'C#',           color: '#239120' },
  cpp:         { abbr: 'C++',  name: 'C++',          color: '#00599c' },
  c:           { abbr: 'C',    name: 'C',            color: '#555555' },
  yaml:        { abbr: 'YML',  name: 'YAML',         color: '#cb171e' },
  yml:         { abbr: 'YML',  name: 'YAML',         color: '#cb171e' },
  xml:         { abbr: 'XML',  name: 'XML',          color: '#e37933' },
  graphql:     { abbr: 'GQL',  name: 'GraphQL',      color: '#e535ab' },
  dockerfile:  { abbr: '🐳',  name: 'Dockerfile',   color: '#2496ed' },
  toml:        { abbr: 'TML',  name: 'TOML',         color: '#9c4121' },
  plaintext:   { abbr: 'TXT',  name: 'Plain Text',   color: '#888888' },
  text:        { abbr: 'TXT',  name: 'Plain Text',   color: '#888888' },
  txt:         { abbr: 'TXT',  name: 'Plain Text',   color: '#888888' },
};

const DEFAULT_CONFIG = { abbr: '</>',  name: 'Code', color: '#6366f1' };

function getLangConfig(lang: string) {
  return LANG_CONFIG[lang.toLowerCase().trim()] || { ...DEFAULT_CONFIG, name: lang || 'Code' };
}

export class CodeLangBadgeWidget extends WidgetType {
  lang: string;

  constructor(lang: string) {
    super();
    this.lang = lang;
  }

  eq(other: CodeLangBadgeWidget) {
    return this.lang === other.lang;
  }

  toDOM() {
    const config = getLangConfig(this.lang);

    const wrap = document.createElement('span');
    wrap.className = 'cm-code-lang-badge';

    // Colored abbreviation pill
    const pill = document.createElement('span');
    pill.className = 'cm-code-lang-pill';
    pill.textContent = config.abbr;
    pill.style.backgroundColor = `${config.color}20`;
    pill.style.color = config.color;
    pill.style.border = `1px solid ${config.color}35`;

    // Language name
    const name = document.createElement('span');
    name.className = 'cm-code-lang-name';
    name.textContent = config.name;

    wrap.appendChild(pill);
    wrap.appendChild(name);
    return wrap;
  }
}
