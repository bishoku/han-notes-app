/**
 * hybridSearchService.ts — Unified Hybrid & Semantic Search Engine for HAN Notes.
 * Combines full-text keyword matching, heading breadcrumbs, tag matching,
 * task/decision records, and local ONNX Vector Cosine Similarity search.
 */
import { useNoteStore } from '@/store/noteStore';
import { useTaskStore } from '@/store/taskStore';
import { useDecisionStore } from '@/store/decisionStore';
import { vectorStore } from '@/services/ai/vectorStore';
import { embeddingService } from '@/services/ai/embeddingService';

export type SearchFilterType = 'all' | 'semantic' | 'notes' | 'tasks' | 'decisions' | 'tags';

export interface SearchMatchItem {
  id: string;
  noteId: string;
  title: string;
  path: string;
  heading?: string;
  snippet: string;
  matchType: 'title' | 'heading' | 'content' | 'semantic' | 'task' | 'decision' | 'tag';
  similarityScore?: number; // 0.00 - 1.00
  matchedKeywords: string[];
  tags: string[];
  isCompletedTask?: boolean;
  decisionStatus?: string | null;
  lineNumber?: number;
  score: number;
}

export class HybridSearchService {
  /**
   * Performs hybrid search combining fulltext matching and AI vector search.
   */
  public async search(
    query: string,
    filter: SearchFilterType = 'all',
    signal?: AbortSignal
  ): Promise<{ results: SearchMatchItem[]; isSemanticDone: boolean }> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { results: [], isSemanticDone: true };
    }

    const { notes } = useNoteStore.getState();
    const { tasks } = useTaskStore.getState();
    const { decisions } = useDecisionStore.getState();
    const queryLower = trimmed.toLowerCase();
    const tokens = queryLower.split(/\s+/).filter((t) => t.length > 0);

    const matches: SearchMatchItem[] = [];
    const seenKeys = new Set<string>();

    // ── 1. Full-Text & Title & Tag Matches ──
    if (filter === 'all' || filter === 'notes' || filter === 'tags') {
      for (const note of notes) {
        const titleLower = (note.title || '').toLowerCase();
        const pathLower = (note.id || '').toLowerCase();
        const noteTags = note.tags || [];

        // Title match
        if (titleLower.includes(queryLower) || tokens.every((t) => titleLower.includes(t))) {
          const key = `title_${note.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            matches.push({
              id: key,
              noteId: note.id,
              title: note.title || note.id.split('/').pop() || note.id,
              path: note.id,
              snippet: note.title,
              matchType: 'title',
              matchedKeywords: tokens.filter((t) => titleLower.includes(t)),
              tags: noteTags,
              score: 95 + (titleLower === queryLower ? 15 : 0),
            });
          }
        } else if (pathLower.includes(queryLower)) {
          const key = `path_${note.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            matches.push({
              id: key,
              noteId: note.id,
              title: note.title || note.id.split('/').pop() || note.id,
              path: note.id,
              snippet: note.id,
              matchType: 'title',
              matchedKeywords: [trimmed],
              tags: noteTags,
              score: 80,
            });
          }
        }

        // Tag match
        for (const tag of noteTags) {
          const cleanTag = tag.replace(/^#/, '').toLowerCase();
          const cleanQuery = queryLower.replace(/^#/, '');
          if (cleanTag.includes(cleanQuery)) {
            const key = `tag_${note.id}_${tag}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              matches.push({
                id: key,
                noteId: note.id,
                title: note.title || note.id.split('/').pop() || note.id,
                path: note.id,
                snippet: `Etiket eşleşti: #${tag}`,
                matchType: 'tag',
                matchedKeywords: [tag],
                tags: noteTags,
                score: 75,
              });
            }
          }
        }
      }
    }

    // ── 2. Tasks Matching ──
    if (filter === 'all' || filter === 'tasks') {
      for (const task of tasks) {
        const contentLower = (task.content || '').toLowerCase();
        if (tokens.some((t) => contentLower.includes(t))) {
          const key = `task_${task.note_id}_${task.line_number}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const foundNote = notes.find((n) => n.id === task.note_id);
            matches.push({
              id: key,
              noteId: task.note_id,
              title: foundNote?.title || task.note_id.split('/').pop() || task.note_id,
              path: task.note_id,
              snippet: task.content,
              matchType: 'task',
              matchedKeywords: tokens.filter((t) => contentLower.includes(t)),
              tags: task.tags || foundNote?.tags || [],
              isCompletedTask: task.completed,
              lineNumber: task.line_number,
              score: 70,
            });
          }
        }
      }
    }

    // ── 3. Decisions Matching ──
    if (filter === 'all' || filter === 'decisions') {
      for (const dec of decisions) {
        const contentLower = (dec.content || '').toLowerCase();
        const descLower = (dec.description || '').toLowerCase();
        if (tokens.some((t) => contentLower.includes(t) || descLower.includes(t))) {
          const key = `decision_${dec.note_id}_${dec.line_number}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const foundNote = notes.find((n) => n.id === dec.note_id);
            matches.push({
              id: key,
              noteId: dec.note_id,
              title: foundNote?.title || dec.note_id.split('/').pop() || dec.note_id,
              path: dec.note_id,
              snippet: `${dec.content}${dec.description ? ` — ${dec.description}` : ''}`,
              matchType: 'decision',
              matchedKeywords: tokens.filter((t) => contentLower.includes(t) || descLower.includes(t)),
              tags: dec.tags || foundNote?.tags || [],
              decisionStatus: dec.status,
              lineNumber: dec.line_number,
              score: 72,
            });
          }
        }
      }
    }

    // ── 4. AI Semantic Vector Search ──
    let isSemanticDone = false;
    if (filter === 'all' || filter === 'semantic' || filter === 'notes') {
      try {
        if (!signal?.aborted) {
          const queryVector = await embeddingService.embedQuery(trimmed);
          if (queryVector.length > 0 && !signal?.aborted) {
            const semanticHits = await vectorStore.searchSimilar(queryVector, 20, 0.18);

            for (const hit of semanticHits) {
              const { chunk, similarity } = hit;
              const foundNote = notes.find((n) => n.id === chunk.noteId);
              if (!foundNote) {
                // Orphan chunk from a renamed/deleted note: purge asynchronously & skip
                vectorStore.deleteNoteChunks(chunk.noteId).catch(() => {});
                continue;
              }

              const key = `sem_${chunk.id}`;
              const noteTitle = foundNote.title || chunk.title || chunk.noteId.split('/').pop() || chunk.noteId;

              // Check if we already have this note's chunk
              const existingIdx = matches.findIndex((m) => m.noteId === chunk.noteId && m.heading === chunk.heading);

              if (existingIdx !== -1) {
                // Enrich existing keyword match with semantic score
                matches[existingIdx].similarityScore = similarity;
                matches[existingIdx].score = Math.max(matches[existingIdx].score, similarity * 100 + 10);
                if (!matches[existingIdx].heading && chunk.heading) {
                  matches[existingIdx].heading = chunk.heading;
                }
              } else {
                matches.push({
                  id: key,
                  noteId: chunk.noteId,
                  title: noteTitle,
                  path: chunk.noteId,
                  heading: chunk.heading,
                  snippet: chunk.content.slice(0, 180) + (chunk.content.length > 180 ? '...' : ''),
                  matchType: 'semantic',
                  similarityScore: similarity,
                  matchedKeywords: tokens.filter((t) => chunk.content.toLowerCase().includes(t)),
                  tags: foundNote.tags || [],
                  score: similarity * 100,
                });
              }
            }
          }
        }
        isSemanticDone = true;
      } catch (err) {
        console.warn('Semantic search error in hybridSearchService:', err);
        isSemanticDone = true;
      }
    } else {
      isSemanticDone = true;
    }

    // Sort by descending score
    matches.sort((a, b) => b.score - a.score);

    return { results: matches, isSemanticDone };
  }
}

export const hybridSearchService = new HybridSearchService();
