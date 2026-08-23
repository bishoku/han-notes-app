# AI Assistant & Local RAG (Retrieval-Augmented Generation)

H.A.N. includes a privacy-respecting AI assistant powered by **Local-First Vector Embeddings** and **Flexible LLM Provider Integrations**. You can chat with your entire knowledge vault, ask questions about specific notes, draft content, and view the AI's internal reasoning process.

---

## 🔒 Privacy-First Architecture

Unlike traditional AI note tools that upload your entire vault to cloud vector databases:
1. **Local Embeddings**: Note chunks are converted into dense vector embeddings **directly on your device** using an in-browser WebWorker running ONNX quantized models (`Xenova/all-MiniLM-L6-v2` / `multilingual-e5-small`).
2. **IndexedDB Vector Store**: Embeddings and semantic chunks are stored in an encrypted client-side IndexedDB database.
3. **Selective Querying**: Only the most relevant semantic text snippets for your prompt are passed to your chosen LLM endpoint.
4. **Encrypted Keys**: API keys are encrypted client-side using AES-GCM before saving to local storage.

---

## ⚙️ Supported LLM Providers & Setup

H.A.N. supports any OpenAI-compatible endpoint, cloud gateways, or local offline LLMs:

| Provider | Description | Default Base URL |
| :--- | :--- | :--- |
| **OpenRouter** *(Recommended)* | Access Claude 3.5, GPT-4o, DeepSeek-R1, Llama 3, Qwen | `https://openrouter.ai/api/v1` |
| **Ollama** *(100% Offline)* | Run local open-source models on your Mac or PC | `http://localhost:11434/v1` |
| **OpenAI** | Official GPT-4o, GPT-4o-mini | `https://api.openai.com/v1` |
| **Custom / LM Studio / vLLM** | Any OpenAI-compatible REST server | Custom URL |

### Configuration Steps
1. Click **Settings** (gear icon) in the bottom sidebar.
2. Select the **Integrations (AI)** tab.
3. Toggle **Enable AI Assistant** to ON.
4. Select your **Provider** (e.g. OpenRouter or Ollama).
5. Enter your **API Key** (optional for local Ollama) and select your **Model**.
6. Set your custom **System Prompt**, **Temperature**, and **Max Tokens**.
7. Click **Reindex Vault Vectors** to compute embeddings for your notes.

---

## 💬 AI Chat Drawer & Multi-Session Capabilities

Open the AI Drawer by clicking the sparkle icon in the header or pressing <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>.

```
┌────────────────────────────────────────────────────────────┐
│ 🤖 H.A.N. AI Assistant                       [+ New] [×]   │
├────────────────────────────────────────────────────────────┤
│ 📎 Attached: [Architecture.md ✕] [Database-Spec.md ✕]     │
├────────────────────────────────────────────────────────────┤
│ 👤 User:                                                   │
│   How does our authentication handle token refresh?        │
│                                                            │
│ 🤖 Assistant:                                              │
│   ┌──────────────────────────────────────────────────────┐ │
│   │ 💭 Thinking Process (3 steps)                        │ │
│   │   1. Locating Auth-Spec.md and token rotation logic...│ │
│   │   2. Found refresh token endpoint in Architecture.   │ │
│   └──────────────────────────────────────────────────────┘ │
│   Based on your notes in **Auth-Spec.md**, token refresh   │
│   uses an asymmetric JWT rotation protocol:                │
│   - Short-lived Access Token (15 min)                      │
│   - Refresh Token stored in httpOnly Secure Cookie         │
├────────────────────────────────────────────────────────────┤
│ [ Ask anything about your vault or active note...       ▲] │
└────────────────────────────────────────────────────────────┘
```

### Key Chat Features
- **Note-Scoped Sessions**: Each note can maintain its own persistent chat history. When you switch notes, the AI assistant automatically recalls the conversation relevant to that note.
- **Global Vault Sessions**: Create generic or project-wide chat sessions unattached to any single note.
- **Multi-Note Context Attachment**: Explicitly attach 1 or more specific notes as primary context using the `+ Attach Note` pill.
- **RAG Retrieval**: The AI automatically searches your local vector store for semantic matches and cites referenced notes.
- **Stop Streaming**: Real-time token streaming with instant abort control.

---

## 🧠 Deep Reasoning & `<think>` Process Extraction

H.A.N. features custom Rust and WebAssembly parser logic (`parse_reasoning_blocks`) to cleanly format reasoning tokens from modern reasoning models (such as **DeepSeek-R1**, **Qwen 2.5 Max**, **o1/o3-mini**, and local reasoning quants).

- **Collapsible Thinking Block**: Raw thoughts, internal scratchpads (`<think>...</think>`, `<|thought|>...<|endofthought|>`, ` ```thought `) are automatically separated from the final response and rendered in an elegant, collapsible **"Thinking Process"** widget.
- **Clean Markdown Output**: The user-facing answer is cleanly rendered without internal chain-of-thought tokens polluting the response.

---

## ✍️ Inline AI Composer

When writing in the editor, you can trigger the **Inline AI Composer** to generate, summarize, or refactor text in-place:
- Ask AI to summarize the selected section.
- Generate boilerplate task checklists or decision templates.
- Translate paragraphs between languages.
- Accept, reject, or regenerate the drafted output with one click.
