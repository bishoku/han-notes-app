/**
 * eventBus.ts — Type-safe, centralized application event bus.
 * Replaces ad-hoc `window.dispatchEvent(new CustomEvent(...))` with fully typed,
 * leak-safe pub/sub subscriptions that return cleanup unbind functions.
 */
import type { FullscreenMediaData } from '@/components/ui/MediaFullscreenModal';
import type { LinkPreviewData } from '@/components/ui/LinkPreviewPopover';
import type { WebLinkFullscreenData } from '@/components/ui/WebLinkFullscreenModal';

export interface AppEvents {
  'note:flush-save': void;
  'note:reloaded': { noteId: string; content: string };
  'editor:outline-update': string;
  'editor:scroll-to-heading': { line: number };
  'modal:open-media-fullscreen': FullscreenMediaData;
  'modal:request-delete-image': { from: number; to: number; isDiagram: boolean; relPath: string };
  'modal:edit-mermaid': { code: string; width?: number | null; from?: number; to?: number };
  'modal:request-delete-mermaid': { from: number; to: number };
  'modal:edit-code-block': { code: string; lang?: string; from?: number; to?: number };
  'modal:request-delete-code-block': { from: number; to: number };
  'preview:show-link': LinkPreviewData;
  'preview:hide-link': void;
  'modal:open-weblink-fullscreen': WebLinkFullscreenData;
  'modal:pdf-import': { file: File; buffer: ArrayBuffer };
  'clipper:open-modal': void;
  'file-tree:open-move-modal': { path: string; name: string; isDir: boolean };
  'attachment:saved': { path: string };
}

type EventHandler<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<keyof AppEvents, Set<EventHandler<any>>>();

  /**
   * Subscribes to an application event.
   * @returns Unsubscribe function to call inside React `useEffect` cleanups.
   */
  public on<K extends keyof AppEvents>(
    event: K,
    handler: EventHandler<AppEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Emits an application event with the corresponding typed payload.
   */
  public emit<K extends keyof AppEvents>(
    event: K,
    ...args: AppEvents[K] extends void ? [] : [AppEvents[K]]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    const payload = args[0];
    for (const handler of Array.from(handlers)) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${String(event)}":`, err);
      }
    }
  }

  /**
   * Clears all active event listeners.
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
