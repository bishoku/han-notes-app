/**
 * bookmarkletGenerator.ts — Generates the bookmarklet JavaScript code
 * that users can drag to their browser bookmarks bar.
 *
 * Architecture:
 * - Runs 100% locally in the browser with zero external CDN / network scripts.
 * - Captures document.documentElement.outerHTML, document.title, and window.location.href.
 * - Opens the H.A.N. Notes web application in a new tab (#/import-clip).
 * - Implements a robust two-way handshake over window.postMessage.
 * - Cleans up listeners and memory references once transfer completes.
 */

/**
 * Returns the default import URL for H.A.N. Notes based on current window location.
 */
export function getDefaultAppImportUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:5173/#/import-clip';
  const origin = window.location.origin;
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return `${origin}${pathname}/#/import-clip`;
}

/**
 * Generates the raw (unencoded) JavaScript IIFE code for the bookmarklet.
 */
export function generateRawBookmarkletScript(targetAppUrl?: string): string {
  const appUrl = targetAppUrl || getDefaultAppImportUrl();

  return `(function(){
  try {
    var appUrl = ${JSON.stringify(appUrl)};
    var popup = window.open(appUrl, 'han_notes_app');
    if (!popup) {
      alert('H.A.N. Not Defteri açılamadı. Lütfen bu site için açılır pencerelere (pop-up) izin verin.');
      return;
    }
    try {
      popup.focus();
    } catch (e) {}

    var timeoutId;
    function handleMessage(event) {
      if (!event.data || event.data.type !== 'CLIPPER_READY') return;

      var payload = {
        html: document.documentElement.outerHTML,
        url: window.location.href,
        title: document.title || ''
      };

      try {
        popup.postMessage({
          type: 'CLIPPER_DATA',
          payload: payload
        }, '*');
      } catch (err) {
        console.error('[HAN Clipper] Veri aktarımı başarısız:', err);
      } finally {
        window.removeEventListener('message', handleMessage);
        clearTimeout(timeoutId);
        payload = null;
      }
    }

    window.addEventListener('message', handleMessage);

    timeoutId = setTimeout(function() {
      window.removeEventListener('message', handleMessage);
    }, 60000);
  } catch (e) {
    alert('H.A.N. Clipper hatası: ' + (e && e.message ? e.message : e));
  }
})();`;
}

/**
 * Generates the URL-encoded bookmarklet link href ("javascript:(function(){...})()").
 */
export function generateBookmarkletHref(targetAppUrl?: string): string {
  const raw = generateRawBookmarkletScript(targetAppUrl);
  // Minify slightly by stripping consecutive newlines/spaces
  const compact = raw
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '') // remove comments
    .replace(/\s+/g, ' ')
    .trim();

  return `javascript:${encodeURIComponent(compact)}`;
}
