/**
 * urlMetadata.ts — Helper utility to parse web URLs, extract domains,
 * resolve high-resolution favicons, and generate rich link preview data
 * (YouTube thumbnails, GitHub repositories, Wikipedia articles, etc.).
 */

export interface LinkMetadata {
  url: string;
  domain: string;
  hostname: string;
  protocol: string;
  pathname: string;
  faviconUrl: string;
  displayTitle: string;
  snippet?: string;
  thumbnailUrl?: string;
  serviceType?: 'youtube' | 'github' | 'twitter' | 'wikipedia' | 'docs' | 'generic';
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeVideoId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host.includes('youtube.com')) {
    return urlObj.searchParams.get('v');
  }
  if (host.includes('youtu.be')) {
    return urlObj.pathname.slice(1).split('/')[0] || null;
  }
  return null;
}

/**
 * Generate rich LinkMetadata for any web URL
 */
export function parseLinkMetadata(rawUrl: string, customLabel?: string): LinkMetadata {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./i, '');
    const protocol = urlObj.protocol.replace(':', '').toUpperCase();
    const pathname = urlObj.pathname === '/' ? '' : urlObj.pathname;
    
    // High-resolution Google S2 Favicon service with DuckDuckGo fallback
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;

    let displayTitle = customLabel?.trim() || '';
    let snippet = `${hostname}${pathname}${urlObj.search}`;
    let thumbnailUrl: string | undefined;
    let serviceType: LinkMetadata['serviceType'] = 'generic';

    // 1. YouTube Detection
    const ytVideoId = extractYouTubeVideoId(urlObj);
    if (ytVideoId) {
      serviceType = 'youtube';
      thumbnailUrl = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;
      if (!displayTitle || displayTitle === rawUrl) {
        displayTitle = 'YouTube Videosu';
      }
      snippet = `youtube.com/watch?v=${ytVideoId}`;
    }
    // 2. GitHub Detection
    else if (hostname.includes('github.com')) {
      serviceType = 'github';
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const [owner, repo] = parts;
        if (!displayTitle || displayTitle === rawUrl) {
          displayTitle = `${owner} / ${repo}`;
        }
        snippet = `GitHub Repository (${owner}/${repo})`;
      } else if (parts.length === 1) {
        if (!displayTitle || displayTitle === rawUrl) {
          displayTitle = `@${parts[0]}`;
        }
        snippet = `GitHub Kullanıcı Profili`;
      }
    }
    // 3. Twitter / X Detection
    else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      serviceType = 'twitter';
      if (!displayTitle || displayTitle === rawUrl) {
        displayTitle = 'X (Twitter) Paylaşımı';
      }
    }
    // 4. Wikipedia Detection
    else if (hostname.includes('wikipedia.org')) {
      serviceType = 'wikipedia';
      const titleFromPath = decodeURIComponent(urlObj.pathname.split('/').pop() || '').replace(/_/g, ' ');
      if (!displayTitle || displayTitle === rawUrl) {
        displayTitle = titleFromPath || 'Vikipedi Maddesi';
      }
    }

    // Default title fallback
    if (!displayTitle || displayTitle === rawUrl) {
      displayTitle = hostname;
    }

    return {
      url,
      domain: hostname,
      hostname,
      protocol,
      pathname,
      faviconUrl,
      displayTitle,
      snippet,
      thumbnailUrl,
      serviceType,
    };
  } catch {
    return {
      url: rawUrl,
      domain: rawUrl,
      hostname: rawUrl,
      protocol: 'HTTPS',
      pathname: '',
      faviconUrl: '',
      displayTitle: customLabel || rawUrl,
      snippet: rawUrl,
      serviceType: 'generic',
    };
  }
}
