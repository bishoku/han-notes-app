import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // ─── Sidebar ──────────────────────────────────────────────────
      "tasks": "All Tasks",
      "settings": "Settings",
      "theme": "Theme",
      "language": "Language",
      "search": "Search (Cmd+K)",
      "backlinks": "Backlinks",
      "aiAssistant": "AI Assistant",
      "outline": "Outline",
      "vault": "Vault",
      "tags": "Tags",
      "cancel": "Cancel",
      "newNote": "New Note",
      "newFolder": "New Folder",
      "rename": "Rename",
      "delete": "Delete",
      "decisions": "Decisions",
      "selectNotePrompt": "Select a note or create a new one.",
      "modePreview": "Preview",
      "modeRaw": "Raw",

      // ─── Editor Header ────────────────────────────────────────────
      "editNoteTags": "Edit Note Tags",
      "addTag": "+ Tag",
      "editTags": "Edit",
      "noteTags": "Note Tags",
      "tagPlaceholder": "Add tag (e.g. architecture)...",

      // ─── Floating Block Menu ──────────────────────────────────────
      "editTaskProps": "Edit Task Properties (Date, Tag, Priority, Assignee)",
      "editDecisionProps": "Edit Decision Properties (Participant, Approver, Date, Tag)",
      "task": "Task",
      "decisionRecord": "Decision Record",

      // ─── Edit Modal ───────────────────────────────────────────────
      "save": "Save",

      // ─── Task Edit Modal ──────────────────────────────────────────
      "editTaskDetails": "Edit Task Details",
      "taskTitle": "Task Description",
      "taskTitlePlaceholder": "Task name...",
      "description": "Description (Details)",
      "taskDescPlaceholder": "Additional details about the task...",
      "taskTimeline": "Task Timeline (Date Range)",
      "priorityLevel": "Priority Level",
      "priorityLow": "Low",
      "priorityMedium": "Medium",
      "priorityHigh": "High",
      "priorityUrgent": "Urgent",
      "progress": "Progress",
      "assignees": "Assignees",
      "assigneePlaceholder": "Add person (e.g. John, @dev)...",
      "tagsLabel": "Tags",
      "tagsPlaceholder": "Add tag (e.g. frontend, bug)...",
      "markCompleted": "Mark as completed",

      // ─── Decision Edit Modal ──────────────────────────────────────
      "editDecision": "Edit Decision Record",
      "decisionTitle": "Decision Title / Text",
      "decisionTitlePlaceholder": "Decision taken...",
      "decisionRationale": "Decision Rationale / Notes",
      "decisionRationalePlaceholder": "Why was this decision made, details...",
      "decisionStatus": "Decision Status",
      "statusApproved": "Approved",
      "statusDraft": "Draft / Pending",
      "statusDeferred": "Deferred",
      "decisionDate": "Decision Date",
      "datePlaceholder": "Select Date...",
      "participants": "Participants",
      "participantPlaceholder": "Add participant (e.g. John, Jane)...",
      "approvedBy": "Approved By",
      "approverPlaceholder": "Add approver (e.g. @management)...",
      "decisionTagsPlaceholder": "Add tag (e.g. architecture, budget)...",

      // ─── Slash Commands ───────────────────────────────────────────
      "slashHeading1": "Heading 1",
      "slashHeading1Desc": "Top-level heading",
      "slashHeading2": "Heading 2",
      "slashHeading2Desc": "Section heading",
      "slashHeading3": "Heading 3",
      "slashHeading3Desc": "Sub-section heading",
      "slashTask": "Task / Checklist",
      "slashTaskDesc": "Trackable task item",
      "slashDecision": "Decision Record",
      "slashDecisionDesc": "Record a decision",
      "slashCodeBlock": "Code Block",
      "slashCodeBlockDesc": "Syntax highlighted code",
      "slashQuote": "Blockquote",
      "slashQuoteDesc": "Quotation or note",
      "slashTable": "Table",
      "slashTableDesc": "Data table",
      "slashImage": "Image / GIF",
      "slashImageDesc": "Upload image or GIF",
      "slashTag": "Tag Note",
      "slashTagDesc": "Add tag to note",
      "slashDiagram": "Architecture Diagram",
      "slashDiagramDesc": "Create interactive YADA diagram",
      "slashNoteCallout": "Note Callout",
      "slashNoteCalloutDesc": "Insert info callout box",
      "slashWarningCallout": "Warning Callout",
      "slashWarningCalloutDesc": "Insert warning callout box",
      "slashTipCallout": "Tip Callout",
      "slashTipCalloutDesc": "Insert tip callout box",
      "slashHR": "Divider",
      "slashHRDesc": "Insert horizontal line divider",
      "slashMenuCommands": "Commands",
      "slashMenuHint": "↑↓ select · ↵ apply",

      // ─── Widgets ──────────────────────────────────────────────────
      "overdue": "Overdue",
      "approved": "Approved",
      "draft": "Draft",
      "deferred": "Deferred",

      // ─── Right Panel ──────────────────────────────────────────────
      "noteTasks": "Note Tasks",
      "editTaskProperties": "Edit Task Properties",

      // ─── Tasks View ───────────────────────────────────────────────
      "taskChart": "Task Chart",
      "taskBased": "Task Based",
      "taskList": "Tasks",
      "overdueTasks": "Overdue",

      // ─── Decisions View ───────────────────────────────────────────
      "decisionRecords": "Decision Records",
      "totalDecisions": "Total Decisions",
      "approvedDecisions": "Approved Decisions",
      "pendingDrafts": "Pending / Drafts",
      "drafts": "Drafts",
      "editDecisionTitle": "Edit Decision",

      // ─── Diagram & Sketch Modal ────────────────────────────────────
      "diagramEditorTitle": "Diagram Editor (YADA)",
      "excalidrawEditorTitle": "Excalidraw Whiteboard & Sketch",
      "slashSketch": "Freehand Sketch",
      "slashSketchDesc": "Hand-drawn sketch and whiteboard with Excalidraw",
      "loading": "Loading...",
      "confirmDeleteTitle": "Confirm Deletion",
      "confirmDeleteDiagramMessage": "Are you sure you want to remove this diagram from your note?",
      "confirmDeleteImageMessage": "Are you sure you want to remove this image from your note?",
      "workspace": "Workspace / Vault",
      "currentVault": "Active Vault Folder",
      "noVaultSelected": "No folder selected",
      "changeFolder": "Change Folder",
      "vaultSwitchDescription": "Switch to a different folder to organize notes across separate workspaces.",
      "switching": "Switching...",
    }
  },
  tr: {
    translation: {
      // ─── Sidebar ──────────────────────────────────────────────────
      "tasks": "Tüm Görevler",
      "settings": "Ayarlar",
      "theme": "Tema",
      "language": "Dil",
      "search": "Hızlı Arama (Cmd+K)",
      "backlinks": "Bağlantılar",
      "aiAssistant": "AI Asistan",
      "outline": "İçindekiler",
      "vault": "Kasa",
      "tags": "Etiketler",
      "cancel": "İptal",
      "newNote": "Yeni Not",
      "newFolder": "Yeni Klasör",
      "rename": "Yeniden Adlandır",
      "delete": "Sil",
      "decisions": "Kararlar",
      "selectNotePrompt": "Bir not seçin veya yeni bir not oluşturun.",
      "modePreview": "Önizleme",
      "modeRaw": "Ham Metin",

      // ─── Editor Header ────────────────────────────────────────────
      "editNoteTags": "Not Etiketlerini Düzenle",
      "addTag": "+ Etiket",
      "editTags": "Düzenle",
      "noteTags": "Not Etiketleri",
      "tagPlaceholder": "Etiket ekle (örn. mimari)...",

      // ─── Floating Block Menu ──────────────────────────────────────
      "editTaskProps": "Görev Özelliklerini Düzenle (Tarih, Etiket, Öncelik, Atanan)",
      "editDecisionProps": "Karar Özelliklerini Düzenle (Katılımcı, Onaylayan, Tarih, Etiket)",
      "task": "Görev (Task)",
      "decisionRecord": "Karar Kaydı (Decision)",

      // ─── Edit Modal ───────────────────────────────────────────────
      "save": "Kaydet",

      // ─── Task Edit Modal ──────────────────────────────────────────
      "editTaskDetails": "Görev Detaylarını Düzenle",
      "taskTitle": "Görev Tanımı",
      "taskTitlePlaceholder": "Görev adı...",
      "description": "Açıklama (Detaylar)",
      "taskDescPlaceholder": "Görev hakkında ek açıklamalar...",
      "taskTimeline": "Görev Zaman Çizelgesi (Tarih Aralığı)",
      "priorityLevel": "Öncelik Seviyesi",
      "priorityLow": "Düşük (Low)",
      "priorityMedium": "Orta (Medium)",
      "priorityHigh": "Yüksek (High)",
      "priorityUrgent": "Acil (Urgent)",
      "progress": "İlerleme",
      "assignees": "Atanan Kişiler (Assignees)",
      "assigneePlaceholder": "Kişi ekle (örn. Barış, @dev)...",
      "tagsLabel": "Etiketler (Tags)",
      "tagsPlaceholder": "Etiket ekle (örn. frontend, bug)...",
      "markCompleted": "Tamamlandı olarak işaretle",

      // ─── Decision Edit Modal ──────────────────────────────────────
      "editDecision": "Karar Kaydını Düzenle",
      "decisionTitle": "Karar Başlığı / Metni",
      "decisionTitlePlaceholder": "Alınan karar...",
      "decisionRationale": "Karar Gerekçesi / Ek Açıklamalar",
      "decisionRationalePlaceholder": "Neden bu karar alındı, detaylar...",
      "decisionStatus": "Karar Durumu",
      "statusApproved": "Onaylandı (Approved)",
      "statusDraft": "Taslak / Beklemede (Draft)",
      "statusDeferred": "Ertelendi (Deferred)",
      "decisionDate": "Karar Tarihi",
      "datePlaceholder": "Tarih Seçin...",
      "participants": "Karara Dahil Olanlar (Participants)",
      "participantPlaceholder": "Katılımcı ekle (örn. Barış, Hasan)...",
      "approvedBy": "Kararı Onaylayanlar (Approved By)",
      "approverPlaceholder": "Onaylayan ekle (örn. @yönetim)...",
      "decisionTagsPlaceholder": "Etiket ekle (örn. mimari, bütçe)...",

      // ─── Slash Commands ───────────────────────────────────────────
      "slashHeading1": "Başlık 1",
      "slashHeading1Desc": "Ana başlık",
      "slashHeading2": "Başlık 2",
      "slashHeading2Desc": "Bölüm başlığı",
      "slashHeading3": "Başlık 3",
      "slashHeading3Desc": "Alt bölüm başlığı",
      "slashTask": "Görev / Kontrol Listesi",
      "slashTaskDesc": "Takip edilebilir görev",
      "slashDecision": "Karar Kaydı",
      "slashDecisionDesc": "Bir kararı kaydet",
      "slashCodeBlock": "Kod Bloğu",
      "slashCodeBlockDesc": "Sözdizimi vurgulu kod",
      "slashQuote": "Alıntı",
      "slashQuoteDesc": "Alıntı veya not",
      "slashTable": "Tablo",
      "slashTableDesc": "Veri tablosu",
      "slashImage": "Görsel / GIF",
      "slashImageDesc": "Görsel veya GIF yükle",
      "slashTag": "Not Etiketle",
      "slashTagDesc": "Nota etiket ekle",
      "slashDiagram": "Mimari Diyagram",
      "slashDiagramDesc": "Etkileşimli YADA diyagramı oluştur",
      "slashNoteCallout": "Bilgi Kutusu",
      "slashNoteCalloutDesc": "Bilgi notu kutusu ekle",
      "slashWarningCallout": "Uyarı Kutusu",
      "slashWarningCalloutDesc": "Uyarı notu kutusu ekle",
      "slashTipCallout": "İpucu Kutusu",
      "slashTipCalloutDesc": "İpucu notu kutusu ekle",
      "slashHR": "Yatay Çizgi",
      "slashHRDesc": "Yatay ayırıcı çizgi ekle",
      "slashMenuCommands": "Komutlar",
      "slashMenuHint": "↑↓ seç · ↵ uygula",

      // ─── Widgets ──────────────────────────────────────────────────
      "overdue": "Gecikmiş",
      "approved": "⚖️ Onaylandı",
      "draft": "⏳ Taslak",
      "deferred": "⏸️ Ertelendi",

      // ─── Right Panel ──────────────────────────────────────────────
      "noteTasks": "Not Görevleri",
      "editTaskProperties": "Görev Özelliklerini Düzenle",

      // ─── Tasks View ───────────────────────────────────────────────
      "taskChart": "Görev Çizelgesi",
      "taskBased": "Görev Bazlı",
      "taskList": "Görevler",
      "overdueTasks": "Gecikmiş",

      // ─── Decisions View ───────────────────────────────────────────
      "decisionRecords": "Karar Kayıtları (Decision Records)",
      "totalDecisions": "Toplam Karar",
      "approvedDecisions": "Onaylanan Kararlar",
      "pendingDrafts": "Taslak / Bekleyen",
      "drafts": "Taslaklar",
      "editDecisionTitle": "Kararı Düzenle",

      // ─── Diagram & Sketch Modal ────────────────────────────────────
      "diagramEditorTitle": "Diyagram Düzenleyici (YADA)",
      "excalidrawEditorTitle": "Excalidraw Serbest Çizim",
      "slashSketch": "Serbest Çizim",
      "slashSketchDesc": "Excalidraw ile el çizimi eskiz ve beyaz tahta",
      "loading": "Yükleniyor...",
      "confirmDeleteTitle": "Silmeyi Onayla",
      "confirmDeleteDiagramMessage": "Bu çizimi / diyagramı nottan kaldırmak istediğinize emin misiniz?",
      "confirmDeleteImageMessage": "Bu görseli nottan kaldırmak istediğinize emin misiniz?",
      "workspace": "Çalışma Alanı / Kasa",
      "currentVault": "Aktif Not Klasörü",
      "noVaultSelected": "Klasör seçilmedi",
      "changeFolder": "Klasör Değiştir",
      "vaultSwitchDescription": "Farklı bir klasör seçerek notlarınızı farklı çalışma alanlarında organize edebilirsiniz.",
      "switching": "Değiştiriliyor...",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "tr",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
