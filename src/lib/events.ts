/**
 * Centralized Type-Safe Event Bus for HAN Notes App.
 */

export interface DiagramEditDetail {
  diagramId: string;
  sourceNoteId: string;
}

export interface DiagramRefreshDetail {
  diagramId: string;
}

export interface AppEventMap {
  'edit-diagram': DiagramEditDetail;
  'refresh-diagram-image': DiagramRefreshDetail;
}

export function emitAppEvent<K extends keyof AppEventMap>(
  eventName: K,
  detail: AppEventMap[K]
): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function subscribeAppEvent<K extends keyof AppEventMap>(
  eventName: K,
  handler: (detail: AppEventMap[K]) => void
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AppEventMap[K]>;
    handler(customEvent.detail);
  };
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
