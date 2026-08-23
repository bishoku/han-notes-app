# Task Management & Gantt

H.A.N. transforms your notes into an actionable project management system without requiring external tools like Jira, Trello, or Linear. Tasks remain plain Markdown checklists while supporting rich metadata, global aggregation, and Gantt timeline visualization.

---

## 📝 Task Syntax & Data Format

A task in H.A.N. begins with standard Markdown checklist syntax (`- [ ]` or `- [x]`). Additional properties are stored in a non-intrusive HTML comment at the end of the line:

```markdown
- [ ] Implement OAuth2 flow <!-- task:{"priority":"high","assignees":["Bariş","Alex"],"start_date":"2026-09-01","end_date":"2026-09-10","progress":40,"tags":["auth","backend"],"description":"Add PKCE support for web client"} -->
```

### Supported Metadata Fields

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `completed` | Boolean | Checked state (`[x]` vs `[ ]`) | `true` / `false` |
| `priority` | String | Urgency level: `low`, `medium`, `high`, `urgent` | `"high"` |
| `assignees` | Array of Strings | Team members or personas responsible | `["Baris", "@dev"]` |
| `start_date` | String (ISO / YYYY-MM-DD) | Scheduled start date | `"2026-09-01"` |
| `end_date` | String (ISO / YYYY-MM-DD) | Due date or deadline | `"2026-09-10"` |
| `progress` | Number (0 - 100) | Percent completed | `75` |
| `tags` | Array of Strings | Category tags | `["frontend", "ui"]` |
| `description` | String | Extended details and context | `"Verify on Safari 17"` |

---

## 🖱️ Interactive Task Editing

### 1. In Live Preview
- **Checkbox Toggle**: Click the checkbox directly in the editor to toggle between completed and incomplete.
- **Badge Pills**: In Live Preview mode, priority, dates, assignees, and progress render as styled pill badges alongside the task text.
- **Floating Block Menu**: Click the floating settings icon next to any task line to open the **Task Edit Modal**.

### 2. Task Edit Modal
The modal provides a clean GUI to modify:
- Task title and extended description
- Date range picker (Start Date & End Date)
- Priority dropdown with color indicators
- Progress slider (0% to 100%)
- Multi-select assignee badges
- Multi-select tag badges

Saving the modal automatically updates the underlying Markdown line without touching the rest of your note.

---

## 🌐 Global Tasks View

Click **Tasks** in the left sidebar to open the **Global Tasks Dashboard**. This view aggregates every task across your entire vault into one unified command center.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 All Vault Tasks (24 Open, 12 Completed)               [List] [📊 Gantt]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Filter tasks...  [Status ▾] [Priority ▾] [Assignee ▾] [Tag ▾] [Date Range]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 📂 Notes/Auth-Spec.md                                                       │
│   ☑️ [Urgent] Implement refresh token rotation        @Baris   📅 Sep 15     │
│   ⬜ [High]   Add PKCE validation for SPA clients      @Alex    📅 Sep 18     │
│                                                                             │
│ 📂 Projects/Frontend-Redesign.md                                            │
│   ⬜ [Med]    Update Geist font variables             @Design  📅 Sep 22     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filtering & Sorting
- **By Status**: Active, Completed, or All.
- **By Priority**: Filter by Urgent, High, Medium, or Low.
- **By Assignee**: Filter tasks assigned to specific people.
- **By Tag**: Drill down into specific project or feature tags.
- **By Date Range**: View tasks due this week, this month, or within a custom window.
- **Search Query**: Real-time fuzzy text search across task descriptions.
- **Jump to Note**: Clicking any task navigates directly to the exact file and line in the editor.

---

## 📊 Gantt Timeline View

Switch from the **List View** to the **Gantt View** using the toggle in the top-right corner of the Tasks Dashboard.

- **Visual Timeline**: Tasks with `start_date` and `end_date` are automatically mapped onto an interactive Gantt chart.
- **Progress Bars**: Each timeline bar visually reflects the current `progress` percentage.
- **Color-Coded Priorities**: Urgent and high-priority tasks are highlighted with warm accent colors.
- **Direct Interaction**: Click any Gantt bar to inspect and update its properties in the Task Edit Modal.
