# Decision Tracking (Architecture Decision Records)

One of H.A.N.'s signature capabilities is **inline Architecture Decision Records (ADRs)**. Engineering teams and solo builders often struggle with documenting *why* technical or product decisions were made. H.A.N. allows you to record decisions directly in the flow of writing notes and aggregates them globally.

---

## 🏛️ Decision Syntax & Format

A decision in H.A.N. begins with `- [D]` or `- [d]` at the start of a list item:

```markdown
- [D] Migrate local storage layer to SQLite for desktop builds <!-- decision:{"status":"approved","date":"2026-09-01","participants":["Baris","Core Team"],"approved_by":["CTO"],"tags":["database","architecture"],"description":"Improves indexing performance on vaults with >10,000 notes."} -->
```

### Supported Metadata Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | String | Lifecycle state: `approved` (green), `draft` / `pending` (amber), `deferred` (gray) |
| `date` | String (YYYY-MM-DD) | The date the decision was agreed upon |
| `participants` | Array of Strings | People involved in discussing or proposing the decision |
| `approved_by` | Array of Strings | Stakeholders or leaders who signed off |
| `tags` | Array of Strings | Technical domain tags (e.g. `architecture`, `security`, `infra`) |
| `description` | String | In-depth rationale, context, tradeoffs, and alternative options considered |

---

## ✍️ How to Log a Decision

1. **Via Slash Command**: Type `/decision` on any empty line. It inserts `- [D] ` with autocomplete.
2. **Via Text**: Type `- [D] Adopt Rust for core parsing algorithms`.
3. **Open Decision Modal**: Click the floating settings icon next to the decision in Live Preview to open the **Decision Edit Modal**:
   - Set status (**Approved**, **Draft / Pending**, or **Deferred**)
   - Select the **Decision Date** using the date picker
   - Add **Participants** and **Approvers** (with auto-suggest from existing registry)
   - Add **Tags** and write a detailed **Rationale / Tradeoffs** description.

---

## 📈 Global Decisions Dashboard

Click **Decisions** in the left sidebar to open the **Decisions Hub**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Architecture & Project Decisions                      [Grid] [📅 Timeline]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│ │ Total: 34     │  │ Approved: 28  │  │ Pending: 4    │  │ Deferred: 2   │  │
│ └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search decisions...  [Status: All ▾] [Tag: All ▾] [Approver: All ▾]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 APPROVED · 2026-08-15                                                    │
│ Use Isomorphic-Git for zero-backend browser sync                            │
│ 👥 Participants: Baris, Architecture Guild · ✅ Approved by: Lead Dev       │
│ 🏷️ git, browser, wasm                                                       │
│ 📄 Note: Architecture/Sync-Protocol.md                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Views & Analytics
1. **Decision Stats Cards**: Displays real-time breakdown of total decisions, approved count, pending drafts, and deferred items.
2. **Grid View**: Clean card-based layout grouping decisions by status and recency.
3. **Timeline View**: Chronological audit trail showing the historical evolution of your architecture decisions over time.
4. **Instant Filtering**: Filter decisions by status, participating team member, approver, or domain tags.
5. **Direct Navigation**: Click on any decision to jump straight to the source note and surrounding documentation context.
