/**
 * codeLanguages.ts — Language registry and metadata configuration for HAN Notes Code Editor.
 */

export interface CodeLanguageDef {
  id: string;
  name: string;
  abbr: string;
  color: string;
  ext: string;
}

export const POPULAR_LANGUAGES: CodeLanguageDef[] = [
  { id: 'typescript', name: 'TypeScript',     abbr: 'TS',   color: '#3178c6', ext: 'ts' },
  { id: 'javascript', name: 'JavaScript',     abbr: 'JS',   color: '#f7df1e', ext: 'js' },
  { id: 'python',     name: 'Python',         abbr: 'PY',   color: '#3776ab', ext: 'py' },
  { id: 'rust',       name: 'Rust',           abbr: 'RS',   color: '#ce412b', ext: 'rs' },
  { id: 'go',         name: 'Go',             abbr: 'GO',   color: '#00add8', ext: 'go' },
  { id: 'sql',        name: 'SQL',            abbr: 'SQL',  color: '#e38c00', ext: 'sql' },
  { id: 'html',       name: 'HTML',           abbr: '< >',  color: '#e34f26', ext: 'html' },
  { id: 'css',        name: 'CSS',            abbr: '#',    color: '#1572b6', ext: 'css' },
  { id: 'json',       name: 'JSON',           abbr: '{ }',  color: '#6d6d6d', ext: 'json' },
  { id: 'bash',       name: 'Bash / Shell',   abbr: '$',    color: '#4eaa25', ext: 'sh' },
  { id: 'java',       name: 'Java',           abbr: 'JV',   color: '#b07219', ext: 'java' },
  { id: 'csharp',     name: 'C#',             abbr: 'C#',   color: '#239120', ext: 'cs' },
  { id: 'cpp',        name: 'C++',            abbr: 'C++',  color: '#00599c', ext: 'cpp' },
  { id: 'c',          name: 'C',              abbr: 'C',    color: '#555555', ext: 'c' },
  { id: 'yaml',       name: 'YAML',           abbr: 'YML',  color: '#cb171e', ext: 'yml' },
  { id: 'dockerfile', name: 'Dockerfile',     abbr: '🐳',   color: '#2496ed', ext: 'dockerfile' },
  { id: 'graphql',    name: 'GraphQL',        abbr: 'GQL',  color: '#e535ab', ext: 'gql' },
  { id: 'kotlin',     name: 'Kotlin',         abbr: 'KT',   color: '#7f52ff', ext: 'kt' },
  { id: 'swift',      name: 'Swift',          abbr: 'SW',   color: '#fa7343', ext: 'swift' },
  { id: 'php',        name: 'PHP',            abbr: 'PHP',  color: '#777bb4', ext: 'php' },
  { id: 'ruby',       name: 'Ruby',           abbr: 'RB',   color: '#cc342d', ext: 'rb' },
  { id: 'markdown',   name: 'Markdown',       abbr: 'MD',   color: '#083fa1', ext: 'md' },
  { id: 'plaintext',  name: 'Plain Text',     abbr: 'TXT',  color: '#888888', ext: 'txt' },
];

const LANG_MAP: Record<string, CodeLanguageDef> = {};
POPULAR_LANGUAGES.forEach((l) => {
  LANG_MAP[l.id.toLowerCase()] = l;
});

export function getLanguageConfig(lang: string): CodeLanguageDef {
  const clean = (lang || '').toLowerCase().trim();
  return LANG_MAP[clean] || { id: lang, name: lang || 'Code', abbr: '</>', color: '#6366f1', ext: 'txt' };
}
