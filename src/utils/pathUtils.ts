/**
 * pathUtils.ts — Centralized path and note ID normalization utilities.
 * Ensures consistent handling of note paths, filenames, folder hierarchies,
 * and .md extensions across desktop and web runtimes.
 */

/**
 * Normalizes a note identifier or file path by stripping .md extension
 * and normalizing directory separators.
 * Example: "projects/alpha.md" -> "projects/alpha"
 */
export function normalizeNoteId(pathOrId: string): string {
  if (!pathOrId) return '';
  return pathOrId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '');
}

/**
 * Ensures a note ID has a `.md` extension for disk storage.
 * Example: "projects/alpha" -> "projects/alpha.md"
 */
export function toNoteFilePath(noteId: string): string {
  const clean = normalizeNoteId(noteId);
  return clean ? `${clean}.md` : '';
}

/**
 * Extracts the user-friendly title (basename) from a note ID or path.
 * Example: "work/meetings/weekly-sync" -> "weekly-sync"
 */
export function extractTitleFromId(noteId: string): string {
  const clean = normalizeNoteId(noteId);
  if (!clean) return '';
  const parts = clean.split('/');
  return parts.pop() || clean;
}

/**
 * Extracts the parent folder path from a note ID or path.
 * Example: "work/meetings/weekly-sync" -> "work/meetings"
 * Example: "standalone-note" -> null
 */
export function extractFolderFromId(noteId: string): string | null {
  const clean = normalizeNoteId(noteId);
  const parts = clean.split('/');
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join('/');
}

/**
 * Checks if two note references refer to the same note (matching by exact ID,
 * normalized ID, or case-insensitive basename).
 */
export function isNoteIdMatch(
  idA: string | null | undefined,
  idB: string | null | undefined
): boolean {
  if (!idA || !idB) return false;
  const cleanA = normalizeNoteId(idA).toLowerCase();
  const cleanB = normalizeNoteId(idB).toLowerCase();

  if (cleanA === cleanB) return true;

  const stemA = cleanA.split('/').pop();
  const stemB = cleanB.split('/').pop();
  return !!stemA && stemA === stemB;
}
