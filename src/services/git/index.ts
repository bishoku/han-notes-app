/**
 * Git Service — Environment-aware entry point.
 * Selects TauriGitService in desktop or BrowserGitService in web/PWA.
 */
import type { IGitService } from './types';
import { TauriGitService } from './TauriGitService';
import { BrowserGitService } from './BrowserGitService';

export * from './types';
export * from './diffHelper';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function createGitService(): IGitService {
  if (isTauriEnvironment()) {
    return new TauriGitService();
  }
  return new BrowserGitService();
}

export const gitService: IGitService = createGitService();
