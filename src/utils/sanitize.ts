/**
 * Security utilities for escaping untrusted text and sanitizing HTML/URLs
 * to prevent Cross-Site Scripting (XSS) across Markdown previews, AI chat,
 * and CodeMirror live-preview widgets.
 */

const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: string): string {
    if (!value) return '';
    return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}

const FORBIDDEN_TAGS = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'meta',
    'base',
    'link',
    'style',
    'math',
    'template',
    'noscript',
]);

const URL_ATTRIBUTES = new Set([
    'href',
    'src',
    'xlink:href',
    'action',
    'formaction',
    'poster',
    'cite',
    'data',
]);

export function isSafeUrl(rawUrl: string, allowDataImage = false): boolean {
    const trimmed = rawUrl.trim();
    if (!trimmed) return true;

    // Allow relative paths, hash anchors, and query params
    if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('./') ||
        trimmed.startsWith('../') ||
        trimmed.startsWith('?')
    ) {
        return true;
    }

    // Strip ASCII control characters and whitespace when checking protocol
    // eslint-disable-next-line no-control-regex
    const normalized = trimmed.replace(/[\u0000-\u0020]+/g, '').toLowerCase();

    if (
        normalized.startsWith('javascript:') ||
        normalized.startsWith('vbscript:') ||
        normalized.startsWith('file:')
    ) {
        return false;
    }

    if (normalized.startsWith('data:')) {
        if (!allowDataImage) return false;
        return /^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(normalized);
    }

    // Allow safe protocols or plain relative filenames without scheme
    if (!normalized.includes(':')) {
        return true;
    }

    return (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('mailto:') ||
        normalized.startsWith('tel:') ||
        normalized.startsWith('blob:') ||
        normalized.startsWith('asset:') ||
        normalized.startsWith('tauri:')
    );
}

function sanitizeNode(root: ParentNode): void {
    const elements = Array.from(root.querySelectorAll('*'));
    for (const el of elements) {
        const tagName = el.tagName.toLowerCase();
        if (FORBIDDEN_TAGS.has(tagName)) {
            el.remove();
            continue;
        }

        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
            const name = attr.name.toLowerCase();
            const value = attr.value;

            // Remove inline event handlers (onclick, onerror, onload, etc.) and style
            if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
                el.removeAttribute(attr.name);
                continue;
            }

            if (URL_ATTRIBUTES.has(name)) {
                const allowDataImage = tagName === 'img' && name === 'src';
                if (!isSafeUrl(value, allowDataImage)) {
                    el.removeAttribute(attr.name);
                }
            }
        }

        if (tagName === 'a' && el.getAttribute('target') === '_blank') {
            el.setAttribute('rel', 'noopener noreferrer');
        }
    }
}

export function sanitizeHtml(dirtyHtml: string): string {
    if (!dirtyHtml) return '';

    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirtyHtml, 'text/html');
        sanitizeNode(doc.body);
        return doc.body.innerHTML;
    }

    // Fallback for non-DOM environments
    return dirtyHtml
        .replace(/<(script|iframe|object|embed|style|meta|base|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<(script|iframe|object|embed|style|meta|base|form)\b[^>]*\/?>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '');
}
