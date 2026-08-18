/**
 * diffHelper.ts — High performance line-by-line diff calculator for Markdown & code.
 * Computes additions (+), deletions (-), and unchanged context lines between two texts.
 */
import type { GitDiffLine, GitDiffResult } from './types';

/**
 * Calculates a line-by-line diff between two strings using Longest Common Subsequence (LCS).
 */
export function computeLineDiff(oldText: string, newText: string, filePath = ''): GitDiffResult {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const matrix: number[][] = Array(oldLines.length + 1)
    .fill(0)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const lines: GitDiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  const rawDiff: Array<{ type: 'add' | 'delete' | 'context'; content: string; oldIdx?: number; newIdx?: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({ type: 'context', content: oldLines[i - 1], oldIdx: i, newIdx: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      rawDiff.push({ type: 'add', content: newLines[j - 1], newIdx: j });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      rawDiff.push({ type: 'delete', content: oldLines[i - 1], oldIdx: i });
      i--;
    }
  }

  rawDiff.reverse();

  let additions = 0;
  let deletions = 0;

  for (const item of rawDiff) {
    if (item.type === 'add') {
      additions++;
      lines.push({
        type: 'add',
        content: item.content,
        newLineNumber: item.newIdx,
      });
    } else if (item.type === 'delete') {
      deletions++;
      lines.push({
        type: 'delete',
        content: item.content,
        oldLineNumber: item.oldIdx,
      });
    } else {
      lines.push({
        type: 'context',
        content: item.content,
        oldLineNumber: item.oldIdx,
        newLineNumber: item.newIdx,
      });
    }
  }

  return {
    filePath,
    oldContent: oldText,
    newContent: newText,
    lines,
    additions,
    deletions,
  };
}
