/**
 * emojiData.ts — Curated database of emojis with shortcodes, categories, and bilingual search keywords.
 */

export interface EmojiItem {
  emoji: string;
  shortcode: string;
  name: string;
  category: 'frequent' | 'smileys' | 'people' | 'tech' | 'office' | 'objects' | 'nature' | 'symbols';
  keywords: string[];
}

export const EMOJI_CATEGORIES = [
  { id: 'frequent', nameTr: 'Sık Kullanılan', nameEn: 'Frequently Used', icon: '⭐' },
  { id: 'smileys', nameTr: 'İfadeler', nameEn: 'Smileys & Emotion', icon: '😀' },
  { id: 'tech', nameTr: 'Yazılım & Teknoloji', nameEn: 'Tech & Dev', icon: '💻' },
  { id: 'office', nameTr: 'Notlar & Ofis', nameEn: 'Notes & Office', icon: '📝' },
  { id: 'people', nameTr: 'İnsanlar & El', nameEn: 'People & Gestures', icon: '👋' },
  { id: 'objects', nameTr: 'Nesneler & Araçlar', nameEn: 'Objects & Tools', icon: '🛠️' },
  { id: 'nature', nameTr: 'Doğa & Hayvanlar', nameEn: 'Nature & Animals', icon: '🌿' },
  { id: 'symbols', nameTr: 'Semboller & İşaretler', nameEn: 'Symbols & Signs', icon: '⚡' },
] as const;

export const EMOJI_LIST: EmojiItem[] = [
  // ─── Frequently Used / Top Tier ─────────────────────────────────────────────
  { emoji: '🚀', shortcode: 'rocket', name: 'Rocket', category: 'frequent', keywords: ['roket', 'launch', 'deploy', 'fast', 'hizli', 'baslat'] },
  { emoji: '🔥', shortcode: 'fire', name: 'Fire', category: 'frequent', keywords: ['ates', 'hot', 'flame', 'populer', 'trend', 'lit'] },
  { emoji: '💡', shortcode: 'bulb', name: 'Light Bulb', category: 'frequent', keywords: ['fikir', 'idea', 'isik', 'lamba', 'think', 'insight'] },
  { emoji: '✅', shortcode: 'white_check_mark', name: 'White Check Mark', category: 'frequent', keywords: ['check', 'onay', 'tamam', 'done', 'yes', 'dogru', 'success'] },
  { emoji: '⭐', shortcode: 'star', name: 'Star', category: 'frequent', keywords: ['yildiz', 'fav', 'favori', 'favorite', 'important', 'onemli'] },
  { emoji: '📝', shortcode: 'memo', name: 'Memo', category: 'frequent', keywords: ['not', 'note', 'document', 'yazi', 'write', 'paper'] },
  { emoji: '🧠', shortcode: 'brain', name: 'Brain', category: 'frequent', keywords: ['beyin', 'mind', 'think', 'ai', 'zeka', 'knowledge'] },
  { emoji: '⚡', shortcode: 'zap', name: 'High Voltage', category: 'frequent', keywords: ['simsek', 'lightning', 'fast', 'quick', 'energy', 'hiz'] },
  { emoji: '🎯', shortcode: 'dart', name: 'Direct Hit', category: 'frequent', keywords: ['hedef', 'target', 'goal', 'focus', 'odak'] },
  { emoji: '📌', shortcode: 'pushpin', name: 'Pushpin', category: 'frequent', keywords: ['raptiye', 'pin', 'sabitle', 'onemli', 'attach'] },
  { emoji: '⚠️', shortcode: 'warning', name: 'Warning', category: 'frequent', keywords: ['uyari', 'alert', 'caution', 'dikkat', 'danger'] },
  { emoji: '🎉', shortcode: 'tada', name: 'Party Popper', category: 'frequent', keywords: ['kutlama', 'celebrate', 'party', 'congrats', 'tebrik'] },
  { emoji: '❤️', shortcode: 'heart', name: 'Red Heart', category: 'frequent', keywords: ['kalp', 'love', 'sevgi', 'begen'] },
  { emoji: '✨', shortcode: 'sparkles', name: 'Sparkles', category: 'frequent', keywords: ['parilti', 'magic', 'yeni', 'new', 'clean', 'ai', 'feature'] },

  // ─── Tech & Dev ─────────────────────────────────────────────────────────────
  { emoji: '💻', shortcode: 'computer', name: 'Laptop', category: 'tech', keywords: ['bilgisayar', 'laptop', 'kod', 'code', 'dev', 'developer'] },
  { emoji: '🖥️', shortcode: 'desktop', name: 'Desktop Computer', category: 'tech', keywords: ['ekran', 'monitor', 'pc'] },
  { emoji: '🐛', shortcode: 'bug', name: 'Bug', category: 'tech', keywords: ['hata', 'issue', 'problem', 'bozuk', 'debug'] },
  { emoji: '🛠️', shortcode: 'hammer_and_wrench', name: 'Hammer and Wrench', category: 'tech', keywords: ['araclar', 'tools', 'build', 'fix', 'tamir', 'setup', 'config'] },
  { emoji: '⚙️', shortcode: 'gear', name: 'Gear', category: 'tech', keywords: ['ayar', 'settings', 'config', 'sistem', 'cark'] },
  { emoji: '🔒', shortcode: 'lock', name: 'Lock', category: 'tech', keywords: ['kilit', 'secure', 'guvenlik', 'security', 'private', 'auth'] },
  { emoji: '🔓', shortcode: 'unlock', name: 'Unlock', category: 'tech', keywords: ['acik', 'public', 'open'] },
  { emoji: '🔑', shortcode: 'key', name: 'Key', category: 'tech', keywords: ['anahtar', 'api', 'token', 'secret', 'password'] },
  { emoji: '📊', shortcode: 'bar_chart', name: 'Bar Chart', category: 'tech', keywords: ['grafik', 'chart', 'analytics', 'metrik', 'rapor', 'data'] },
  { emoji: '📈', shortcode: 'chart_with_upwards_trend', name: 'Chart Increasing', category: 'tech', keywords: ['artis', 'growth', 'trend', 'performans', 'sales'] },
  { emoji: '📉', shortcode: 'chart_with_downwards_trend', name: 'Chart Decreasing', category: 'tech', keywords: ['dusus', 'decline', 'drop'] },
  { emoji: '🌐', shortcode: 'globe_with_meridians', name: 'Globe', category: 'tech', keywords: ['web', 'internet', 'network', 'dunya', 'global', 'api'] },
  { emoji: '🔗', shortcode: 'link', name: 'Link', category: 'tech', keywords: ['baglanti', 'url', 'chain', 'connect'] },
  { emoji: '📦', shortcode: 'package', name: 'Package', category: 'tech', keywords: ['paket', 'box', 'bundle', 'module', 'npm', 'cargo'] },
  { emoji: '🤖', shortcode: 'robot', name: 'Robot', category: 'tech', keywords: ['bot', 'ai', 'llm', 'otomasyon', 'automation', 'agent'] },
  { emoji: '💾', shortcode: 'floppy_disk', name: 'Floppy Disk', category: 'tech', keywords: ['kaydet', 'save', 'disk', 'storage', 'depolama'] },
  { emoji: '🗄️', shortcode: 'file_cabinet', name: 'File Cabinet', category: 'tech', keywords: ['veritabani', 'database', 'arsiv', 'archive'] },
  { emoji: '📱', shortcode: 'iphone', name: 'Mobile Phone', category: 'tech', keywords: ['telefon', 'mobil', 'app', 'mobile', 'ios', 'android'] },

  // ─── Notes & Office ─────────────────────────────────────────────────────────
  { emoji: '📚', shortcode: 'books', name: 'Books', category: 'office', keywords: ['kitap', 'dokuman', 'kutuphane', 'library', 'docs', 'okuma'] },
  { emoji: '📖', shortcode: 'open_book', name: 'Open Book', category: 'office', keywords: ['kitap', 'read', 'oku', 'manual'] },
  { emoji: '📋', shortcode: 'clipboard', name: 'Clipboard', category: 'office', keywords: ['pano', 'gorevler', 'tasks', 'todo', 'liste'] },
  { emoji: '📁', shortcode: 'file_folder', name: 'File Folder', category: 'office', keywords: ['klasor', 'folder', 'dizin', 'directory'] },
  { emoji: '📂', shortcode: 'open_file_folder', name: 'Open File Folder', category: 'office', keywords: ['acik klasor', 'folder'] },
  { emoji: '📄', shortcode: 'page_facing_up', name: 'Page', category: 'office', keywords: ['sayfa', 'doc', 'metin', 'text', 'file'] },
  { emoji: '📅', shortcode: 'calendar', name: 'Calendar', category: 'office', keywords: ['takvim', 'tarih', 'date', 'schedule', 'plan'] },
  { emoji: '📆', shortcode: 'tear_off_calendar', name: 'Calendar Date', category: 'office', keywords: ['gun', 'day'] },
  { emoji: '⏳', shortcode: 'hourglass_flowing_sand', name: 'Hourglass', category: 'office', keywords: ['kum saati', 'bekleme', 'surec', 'pending', 'wait', 'wip'] },
  { emoji: '⏱️', shortcode: 'stopwatch', name: 'Stopwatch', category: 'office', keywords: ['kronometre', 'sure', 'time', 'timer'] },
  { emoji: '⏰', shortcode: 'alarm_clock', name: 'Alarm Clock', category: 'office', keywords: ['alarm', 'saat', 'deadline', 'vakit'] },
  { emoji: '🏷️', shortcode: 'label', name: 'Label', category: 'office', keywords: ['etiket', 'tag', 'kategori'] },
  { emoji: '🔖', shortcode: 'bookmark', name: 'Bookmark', category: 'office', keywords: ['yer imi', 'isaret', 'save'] },
  { emoji: '🔍', shortcode: 'mag', name: 'Magnifying Glass', category: 'office', keywords: ['ara', 'search', 'find', 'buyutec', 'bul'] },
  { emoji: '💬', shortcode: 'speech_balloon', name: 'Speech Balloon', category: 'office', keywords: ['mesaj', 'chat', 'yorum', 'comment', 'talk'] },
  { emoji: '🗨️', shortcode: 'left_speech_bubble', name: 'Speech Bubble', category: 'office', keywords: ['sohbet', 'discuss'] },
  { emoji: '⚖️', shortcode: 'scales', name: 'Scales', category: 'office', keywords: ['terazi', 'karar', 'decision', 'law', 'hukuk', 'adalet'] },

  // ─── Smileys & Emotion ─────────────────────────────────────────────────────
  { emoji: '😀', shortcode: 'grinning', name: 'Grinning Face', category: 'smileys', keywords: ['gulumse', 'smile', 'happy', 'mutlu'] },
  { emoji: '😃', shortcode: 'smiley', name: 'Grinning Face with Big Eyes', category: 'smileys', keywords: ['neseli', 'joy'] },
  { emoji: '😄', shortcode: 'smile', name: 'Grinning Face with Smiling Eyes', category: 'smileys', keywords: ['gulen', 'mutlu'] },
  { emoji: '😁', shortcode: 'grin', name: 'Beaming Face with Smiling Eyes', category: 'smileys', keywords: ['siritan'] },
  { emoji: '😎', shortcode: 'sunglasses', name: 'Smiling Face with Sunglasses', category: 'smileys', keywords: ['havali', 'cool'] },
  { emoji: '🤓', shortcode: 'nerd_face', name: 'Nerd Face', category: 'smileys', keywords: ['nerd', 'geek', 'caliskan'] },
  { emoji: '🧐', shortcode: 'monocle_face', name: 'Face with Monocle', category: 'smileys', keywords: ['inceleyen', 'curious', 'examine'] },
  { emoji: '🤔', shortcode: 'thinking', name: 'Thinking Face', category: 'smileys', keywords: ['dusunce', 'think', 'hmm', 'merak'] },
  { emoji: '🥳', shortcode: 'partying_face', name: 'Partying Face', category: 'smileys', keywords: ['parti', 'kutlama'] },
  { emoji: '🤩', shortcode: 'star_struck', name: 'Star-Struck', category: 'smileys', keywords: ['hayran', 'harika', 'wow'] },
  { emoji: '😇', shortcode: 'innocent', name: 'Smiling Face with Halo', category: 'smileys', keywords: ['melek', 'angel', 'masum'] },
  { emoji: '👍', shortcode: 'thumbsup', name: 'Thumbs Up', category: 'people', keywords: ['begendim', 'like', 'yes', 'onay', 'harika'] },
  { emoji: '👎', shortcode: 'thumbsdown', name: 'Thumbs Down', category: 'people', keywords: ['begenmedim', 'dislike', 'no'] },
  { emoji: '👏', shortcode: 'clap', name: 'Clapping Hands', category: 'people', keywords: ['alkis', 'bravo', 'tebrik'] },
  { emoji: '🙌', shortcode: 'raised_hands', name: 'Raising Hands', category: 'people', keywords: ['harika', 'hooray'] },
  { emoji: '🤝', shortcode: 'handshake', name: 'Handshake', category: 'people', keywords: ['anlasma', 'agree', 'deal', 'tokalas'] },
  { emoji: '👋', shortcode: 'wave', name: 'Waving Hand', category: 'people', keywords: ['el salla', 'selam', 'hello', 'bye'] },
  { emoji: '👀', shortcode: 'eyes', name: 'Eyes', category: 'people', keywords: ['gozler', 'look', 'bak', 'gor'] },

  // ─── Symbols & Signs ───────────────────────────────────────────────────────
  { emoji: '❌', shortcode: 'x', name: 'Cross Mark', category: 'symbols', keywords: ['carpi', 'iptal', 'cancel', 'no', 'hata', 'red'] },
  { emoji: '🛑', shortcode: 'octagonal_sign', name: 'Stop Sign', category: 'symbols', keywords: ['dur', 'stop', 'engel'] },
  { emoji: '🚨', shortcode: 'rotating_light', name: 'Police Car Light', category: 'symbols', keywords: ['alarm', 'acil', 'urgent', 'siren', 'kritik'] },
  { emoji: '🚩', shortcode: 'triangular_flag_on_post', name: 'Flag', category: 'symbols', keywords: ['bayrak', 'isaret', 'flag', 'milestone'] },
  { emoji: '🟢', shortcode: 'green_circle', name: 'Green Circle', category: 'symbols', keywords: ['yesil', 'online', 'active', 'aktif'] },
  { emoji: '🟡', shortcode: 'yellow_circle', name: 'Yellow Circle', category: 'symbols', keywords: ['sari', 'pending', 'beklemede'] },
  { emoji: '🔴', shortcode: 'red_circle', name: 'Red Circle', category: 'symbols', keywords: ['kirmizi', 'offline', 'durduruldu'] },
  { emoji: '⚪', shortcode: 'white_circle', name: 'White Circle', category: 'symbols', keywords: ['beyaz', 'bos'] },
  { emoji: '⚫', shortcode: 'black_circle', name: 'Black Circle', category: 'symbols', keywords: ['siyah'] },
  { emoji: '➕', shortcode: 'heavy_plus_sign', name: 'Plus', category: 'symbols', keywords: ['arti', 'ekle', 'add'] },
  { emoji: '➖', shortcode: 'heavy_minus_sign', name: 'Minus', category: 'symbols', keywords: ['eksi', 'cikar'] },
  { emoji: '➡️', shortcode: 'arrow_right', name: 'Right Arrow', category: 'symbols', keywords: ['sag', 'ileri', 'next'] },
  { emoji: '⬅️', shortcode: 'arrow_left', name: 'Left Arrow', category: 'symbols', keywords: ['sol', 'geri', 'prev'] },
  { emoji: '⬆️', shortcode: 'arrow_up', name: 'Up Arrow', category: 'symbols', keywords: ['yukari'] },
  { emoji: '⬇️', shortcode: 'arrow_down', name: 'Down Arrow', category: 'symbols', keywords: ['asagi'] },

  // ─── Nature & General Objects ──────────────────────────────────────────────
  { emoji: '🌿', shortcode: 'herb', name: 'Herb', category: 'nature', keywords: ['bitki', 'doga', 'leaf', 'yaprak'] },
  { emoji: '🌱', shortcode: 'seedling', name: 'Seedling', category: 'nature', keywords: ['fidan', 'buyume', 'growth'] },
  { emoji: '☕', shortcode: 'coffee', name: 'Coffee', category: 'objects', keywords: ['kahve', 'mola', 'break'] },
  { emoji: '🏆', shortcode: 'trophy', name: 'Trophy', category: 'objects', keywords: ['kupa', 'kazanma', 'win', 'odul', 'award'] },
  { emoji: '🎨', shortcode: 'art', name: 'Artist Palette', category: 'objects', keywords: ['tasarim', 'design', 'renk', 'art', 'ui'] },
  { emoji: '🎁', shortcode: 'gift', name: 'Wrapped Gift', category: 'objects', keywords: ['hediye', 'surpriz'] },
];

/**
 * Search emojis by query string matching shortcode, name, or keywords
 */
export function searchEmojis(query: string): EmojiItem[] {
  if (!query || !query.trim()) return EMOJI_LIST;
  const clean = query.toLowerCase().trim().replace(/^:/, '').replace(/:$/, '');

  return EMOJI_LIST.filter((item) => {
    if (item.shortcode.includes(clean)) return true;
    if (item.name.toLowerCase().includes(clean)) return true;
    return item.keywords.some((kw) => kw.includes(clean));
  });
}
