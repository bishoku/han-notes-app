# Settings & Customization

H.A.N. is designed to adapt to your personal writing workflow, visual aesthetics, and development toolchain.

---

## 🎨 Themes & Visual Customization

H.A.N. includes 6 meticulously crafted color themes designed for high readability and visual comfort:

| Theme | Type | Aesthetic |
| :--- | :--- | :--- |
| **Light** | Light | Clean, minimal, high-contrast crisp white interface |
| **Dark** | Dark | Deep slate gray and midnight accents for low-light focus |
| **Nord** | Dark/Cool | Arctic-inspired elegant blue-gray tones |
| **Dracula** | Dark/Vibrant | High-contrast purple and pink developer favorite |
| **Synthwave** | Dark/Retro | Neon cyan, magenta, and 80s cyberpunk vibe |
| **Retro** | Warm/Vintage | Warm cream paper background with nostalgic sepia ink |

### Changing the Theme
- Click the **Theme Toggle** in the bottom sidebar or open **Settings** -> **General** to pick your preferred palette.

---

## 🔤 Typography & Font Scaling

Customize editor readability to suit your display and eyesight:
- **Font Sizes**: Small (`sm`), Medium (`md` - default), or Large (`lg`).
- **Font Family**: Premium variable typography powered by [Geist Sans and Geist Mono](https://vercel.com/font) for balanced readability in text and code blocks.

---

## 🌐 Localization (i18n)

H.A.N. features full internationalization support:
- **English** (`en`)
- **Turkish** (`tr`)

Switch languages anytime in **Settings** -> **General** -> **Language**. The UI, slash commands, date pickers, and tooltips update instantly.

---

## ⚙️ Settings Overview

Open the **Settings Modal** by clicking the gear icon at the bottom of the sidebar.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Settings                                      [Close ✕]  │
├─────────────────────┬───────────────────────────────────────┤
│ 🏷️ General           │ 🎨 Appearance & Localization          │
│ 🤖 Integrations (AI)│   Theme: [ Dark (Nord) ▾ ]            │
│ 🐙 Git Sync         │   Font Size: [ Medium ▾ ]             │
│                     │   Language: [ English ▾ ]             │
│                     ├───────────────────────────────────────┤
│                     │ 💾 Data & Storage                     │
│                     │   Active Vault: /Users/name/Notes     │
│                     │   [ Switch Active Vault ]             │
└─────────────────────┴───────────────────────────────────────┘
```

1. **General Tab**: Theme, language, font scale, active vault path, and vault switching.
2. **Integrations (AI) Tab**: LLM provider selection (OpenRouter, Ollama, OpenAI, Custom), API keys, model parameters, and vector store re-indexing.
3. **Git Sync Tab**: Repository initialization, remote URL setup, credentials, and auto-commit / auto-sync interval scheduling.
