/**
 * badgeUtils.ts — Shared DOM helpers for creating inline badge elements
 * used by TaskBadgeWidget and DecisionBadgeWidget.
 */

/**
 * Creates a styled badge `<span>` element with the given className and text.
 */
export function createBadge(className: string, text: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = className;
  badge.textContent = text;
  return badge;
}

/**
 * Creates a badge wrapper `<span>` with consistent inline-flex styling.
 */
export function createBadgeWrapper(): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = 'inline-flex items-center gap-1.5 ml-2 align-middle select-none pointer-events-none text-xs font-sans';
  return wrap;
}

/**
 * Renders tag badges and appends them to the wrapper.
 */
export function appendTagBadges(wrap: HTMLSpanElement, tags: string[]): void {
  if (!Array.isArray(tags)) return;
  for (const tag of tags) {
    wrap.appendChild(createBadge(
      'px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-zinc-700',
      `#${tag}`
    ));
  }
}
