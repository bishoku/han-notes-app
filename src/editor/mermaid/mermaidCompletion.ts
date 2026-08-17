/**
 * mermaidCompletion.ts — Rich autocomplete definitions & snippets for Mermaid.js editing.
 */
import { autocompletion, snippet, type CompletionContext, type CompletionResult, type Completion } from "@codemirror/autocomplete";

const MERMAID_COMPLETIONS: Completion[] = [
  // ─── Headers & Diagram Directives ───
  {
    label: "flowchart TD",
    type: "keyword",
    detail: "Yukarıdan Aşağı Akış Şeması",
    apply: snippet("flowchart TD\n    ${1:A}[${2:Başlangıç}] --> ${3:B}[${4:İşlem}]\n    ${3:B} --> ${5:C}[${6:Bitiş}]"),
    boost: 90,
  },
  {
    label: "flowchart LR",
    type: "keyword",
    detail: "Soldan Sağa Akış Şeması",
    apply: snippet("flowchart LR\n    ${1:A}[${2:Sol}] --> ${3:B}[${4:Sağ}]"),
    boost: 85,
  },
  {
    label: "sequenceDiagram",
    type: "keyword",
    detail: "Sıralı İletişim / Sequence",
    apply: snippet("sequenceDiagram\n    autonumber\n    actor ${1:User} as ${2:Kullanıcı}\n    participant ${3:App} as ${4:Uygulama}\n    \n    ${1:User}->>${3:App}: ${5:İstek Gönder}\n    activate ${3:App}\n    ${3:App}-->>${1:User}: ${6:Yanıt Dön}\n    deactivate ${3:App}"),
    boost: 88,
  },
  {
    label: "classDiagram",
    type: "keyword",
    detail: "Sınıf Diyagramı",
    apply: snippet("classDiagram\n    class ${1:ClassName} {\n        +${2:String} ${3:attribute}\n        +${4:method}() ${5:void}\n    }"),
    boost: 80,
  },
  {
    label: "stateDiagram-v2",
    type: "keyword",
    detail: "Durum Makinesi",
    apply: snippet("stateDiagram-v2\n    [*] --> ${1:Baslangic}\n    ${1:Baslangic} --> ${2:Islemde}: ${3:Olay}\n    ${2:Islemde} --> [*]: ${4:Tamamlandi}"),
    boost: 80,
  },
  {
    label: "erDiagram",
    type: "keyword",
    detail: "Varlık-İlişki (ER) Diyagramı",
    apply: snippet("erDiagram\n    ${1:CUSTOMER} ||--o{ ${2:ORDER} : places\n    ${1:CUSTOMER} {\n        int id PK\n        string name\n    }\n    ${2:ORDER} {\n        int id PK\n        int customer_id FK\n    }"),
    boost: 80,
  },
  {
    label: "gantt",
    type: "keyword",
    detail: "Gantt Zaman Çizelgesi",
    apply: snippet("gantt\n    title ${1:Proje Takvimi}\n    dateFormat YYYY-MM-DD\n    section ${2:Aşama 1}\n        ${3:Görev 1} :active, task1, ${4:2026-08-01}, ${5:7d}"),
    boost: 75,
  },
  {
    label: "gitGraph",
    type: "keyword",
    detail: "Git Versiyon Dal Akışı",
    apply: snippet("gitGraph\n    commit\n    branch ${1:develop}\n    checkout ${1:develop}\n    commit\n    checkout main\n    merge ${1:develop}"),
    boost: 75,
  },
  {
    label: "mindmap",
    type: "keyword",
    detail: "Zihin Haritası",
    apply: snippet("mindmap\n  root((${1:Ana Başlık}))\n    ${2:Dal 1}\n      ${3:Alt Madde A}\n      ${4:Alt Madde B}\n    ${5:Dal 2}"),
    boost: 78,
  },
  {
    label: "pie title",
    type: "keyword",
    detail: "Pasta Grafik",
    apply: snippet("pie title ${1:Grafik Başlığı}\n    \"${2:Kategori A}\" : ${3:60}\n    \"${4:Kategori B}\" : ${5:40}"),
    boost: 70,
  },

  // ─── Flowchart Düğümleri & Şekilleri ───
  {
    label: "subgraph",
    type: "class",
    detail: "Alt Grup / Kapsayıcı Kutu",
    apply: snippet("subgraph ${1:GrupAdı} [${2:Başlık}]\n    ${3:A} --> ${4:B}\nend"),
    boost: 82,
  },
  {
    label: "[Kutu]",
    type: "type",
    detail: "Köşeli Dikdörtgen Düğüm: [Metin]",
    apply: "[${1:Metin}]",
    boost: 60,
  },
  {
    label: "(Yuvarlak Kutu)",
    type: "type",
    detail: "Yuvarlak Köşeli Düğüm: (Metin)",
    apply: "(${1:Metin})",
    boost: 60,
  },
  {
    label: "([Stadyum / Hap])",
    type: "type",
    detail: "Stadyum / Hap Şekli: ([Metin])",
    apply: "([${1:Başlangıç/Bitiş}])",
    boost: 60,
  },
  {
    label: "[(Veritabanı)]",
    type: "type",
    detail: "Silindir Veritabanı Şekli: [(Metin)]",
    apply: "[(${1:Veritabanı})]",
    boost: 65,
  },
  {
    label: "((Daire))",
    type: "type",
    detail: "Dairesel Düğüm: ((Metin))",
    apply: "((${1:Daire}))",
    boost: 60,
  },
  {
    label: "{Karar / Baklava}",
    type: "type",
    detail: "Eşkenar Dörtgen Karar Düğümü: {Karar}",
    apply: "{${1:Karar / Koşul?}}",
    boost: 65,
  },
  {
    label: "{{Altıgen}}",
    type: "type",
    detail: "Altıgen Düğüm: {{Metin}}",
    apply: "{{${1:Hazırlık}}}",
    boost: 55,
  },
  {
    label: "[/Paralelkenar/]",
    type: "type",
    detail: "Giriş/Çıkış Paralelkenar Düğümü",
    apply: "[/${1:Girdi / Çıktı}/]",
    boost: 55,
  },

  // ─── Bağlantılar & Ok Operatörleri ───
  {
    label: "--> (Düz Ok)",
    type: "variable",
    detail: "Standart Yönlü Ok: -->",
    apply: "--> ",
    boost: 70,
  },
  {
    label: "-- Metin --> (Etiketli Ok)",
    type: "variable",
    detail: "Metinli Yönlü Ok: -- Metin -->",
    apply: "-- ${1:Evet} --> ",
    boost: 70,
  },
  {
    label: "-.-> (Kesikli Ok)",
    type: "variable",
    detail: "Kesikli Yönlü Ok: -.->",
    apply: "-.-> ",
    boost: 65,
  },
  {
    label: "==> (Kalın Ok)",
    type: "variable",
    detail: "Vurgulu Kalın Ok: ==>",
    apply: "==> ",
    boost: 65,
  },
  {
    label: "<--> (Çift Yönlü Ok)",
    type: "variable",
    detail: "Çift Yönlü İletişim Oku: <-->",
    apply: "<--> ",
    boost: 60,
  },

  // ─── Sequence Diagram Öğeleri ───
  {
    label: "participant",
    type: "keyword",
    detail: "Sıralı İletişim Katılımcısı",
    apply: snippet("participant ${1:ID} as ${2:Görünen İsim}"),
    boost: 75,
  },
  {
    label: "actor",
    type: "keyword",
    detail: "İnsan Figürlü Katılımcı",
    apply: snippet("actor ${1:User} as ${2:Kullanıcı}"),
    boost: 75,
  },
  {
    label: "activate",
    type: "keyword",
    detail: "Etkinleştirme Çubuğunu Başlat",
    apply: "activate ${1:Katılımcı}",
    boost: 65,
  },
  {
    label: "deactivate",
    type: "keyword",
    detail: "Etkinleştirme Çubuğunu Kapat",
    apply: "deactivate ${1:Katılımcı}",
    boost: 65,
  },
  {
    label: "loop",
    type: "class",
    detail: "Döngü Bloğu",
    apply: snippet("loop ${1:Her öğe için}\n    ${2:Client}->>${3:Server}: ${4:İşlem}\nend"),
    boost: 65,
  },
  {
    label: "alt / else",
    type: "class",
    detail: "Koşullu Dallanma Bloğu",
    apply: snippet("alt ${1:Başarılı ise}\n    ${2:Client}->>${3:User}: ${4:Onay Mesajı}\nelse ${5:Hatalı ise}\n    ${2:Client}->>${3:User}: ${6:Hata Mesajı}\nend"),
    boost: 65,
  },
  {
    label: "Note over",
    type: "text",
    detail: "Katılımcı Üzerinde Not",
    apply: snippet("Note over ${1:Participant}: ${2:Not Metni}"),
    boost: 60,
  },

  // ─── Stilleme & Sınıf Tanımları ───
  {
    label: "classDef",
    type: "keyword",
    detail: "Özel Renk & Çerçeve Stili Tanımı",
    apply: snippet("classDef ${1:vurgu} fill:#${2:3b82f6}20,stroke:#${2:3b82f6},stroke-width:2px;"),
    boost: 55,
  },
  {
    label: "style",
    type: "keyword",
    detail: "Belirli Düğüme Stil Uygula",
    apply: snippet("style ${1:NodeId} fill:#${2:10b981}20,stroke:#${2:10b981},stroke-width:2px;"),
    boost: 55,
  },
];

export function mermaidCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w\-()[\]{}<>=.:/]+/);
  if (!word && !context.explicit) return null;

  return {
    from: word ? word.from : context.pos,
    options: MERMAID_COMPLETIONS,
    validFor: /^[\w\-()[\]{}<>=.:/]*$/,
  };
}

export const mermaidAutocomplete = autocompletion({
  override: [mermaidCompletionSource],
  defaultKeymap: true,
});
