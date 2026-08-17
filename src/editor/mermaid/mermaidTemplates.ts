/**
 * mermaidTemplates.ts — Predefined, beautiful starter templates for Mermaid diagrams.
 */

export interface MermaidTemplate {
  id: string;
  name: string;
  nameTr: string;
  icon: string;
  category: 'flow' | 'sequence' | 'structure' | 'timeline' | 'data' | 'other';
  code: string;
}

export const MERMAID_TEMPLATES: MermaidTemplate[] = [
  {
    id: 'flowchart',
    name: 'Flowchart (Akış Şeması)',
    nameTr: 'Akış Şeması (Flowchart)',
    icon: 'GitFork',
    category: 'flow',
    code: `flowchart TD
    Start([Başlangıç]) --> Input[/Kullanıcı Girişi/]
    Input --> Validate{Veri Geçerli mi?}
    
    Validate -- Evet --> Process[Veriyi İşle & Kaydet]
    Validate -- Hayır --> Alert[Uyarı Göster]
    Alert --> Input
    
    Process --> DB[(Veritabanı)]
    DB --> Success[İşlem Başarılı]
    Success --> End([Bitiş])
    
    classDef success fill:#10b98120,stroke:#10b981,stroke-width:2px;
    classDef warn fill:#f59e0b20,stroke:#f59e0b,stroke-width:2px;
    class Success success;
    class Alert warn;`,
  },
  {
    id: 'sequence',
    name: 'Sequence Diagram (Sıralı İletişim)',
    nameTr: 'Sıralı İletişim (Sequence)',
    icon: 'ArrowRightLeft',
    category: 'sequence',
    code: `sequenceDiagram
    autonumber
    actor User as Kullanıcı
    participant Client as Web İstemci (HAN)
    participant Server as API Sunucu
    participant DB as Veritabanı

    User->>Client: Notu Düzenle ve Kaydet
    activate Client
    Client->>Server: POST /api/notes/update
    activate Server
    Server->>DB: SQL UPDATE notes
    activate DB
    DB-->>Server: OK (200)
    deactivate DB
    Server-->>Client: { success: true, timestamp }
    deactivate Server
    Client-->>User: "Kaydedildi" Bildirimi
    deactivate Client`,
  },
  {
    id: 'class',
    name: 'Class Diagram (Sınıf Yapısı)',
    nameTr: 'Sınıf Diyagramı (Class)',
    icon: 'Layers',
    category: 'structure',
    code: `classDiagram
    class Note {
        +String id
        +String title
        +String content
        +Array~String~ tags
        +Date createdAt
        +Date updatedAt
        +save() bool
        +render() HTMLElement
    }

    class DiagramWidget {
        +String type
        +String sourceCode
        +renderSvg() SvgElement
        +edit() void
    }

    class TaskRecord {
        +String text
        +bool completed
        +Date dueDate
        +toggle() void
    }

    Note "1" *-- "many" DiagramWidget : içerir
    Note "1" *-- "many" TaskRecord : takip eder`,
  },
  {
    id: 'state',
    name: 'State Diagram (Durum Makinesi)',
    nameTr: 'Durum Makinesi (State)',
    icon: 'Activity',
    category: 'structure',
    code: `stateDiagram-v2
    [*] --> Taslak
    
    Taslak --> İncelemede: İnceleme Talep Et
    İncelemede --> Taslak: Düzeltme İste
    İncelemede --> Onaylandı: Onayla
    
    Onaylandı --> Canlıda: Dağıtıma Çıkar
    Canlıda --> Arşivlendi: Süresi Doldu
    
    Arşivlendi --> [*]`,
  },
  {
    id: 'er',
    name: 'Entity Relationship (Varlık-İlişki)',
    nameTr: 'ER Diyagramı (Veritabanı)',
    icon: 'Database',
    category: 'data',
    code: `erDiagram
    USERS ||--o{ NOTES : yazar
    NOTES ||--|{ NOTE_TAGS : icerir
    TAGS ||--o{ NOTE_TAGS : siniflandirir
    NOTES ||--o{ DIAGRAMS : barindirir

    USERS {
        uuid id PK
        string username
        string email
        datetime created_at
    }

    NOTES {
        uuid id PK
        uuid user_id FK
        string title
        text content
        datetime updated_at
    }

    TAGS {
        uuid id PK
        string name
        string color
    }`,
  },
  {
    id: 'gantt',
    name: 'Gantt Chart (Proje Zaman Çizelgesi)',
    nameTr: 'Gantt Çizelgesi (Zaman Planı)',
    icon: 'Calendar',
    category: 'timeline',
    code: `gantt
    title HAN Notes - Sürüm 2.0 Yol Haritası
    dateFormat YYYY-MM-DD
    section Araştırma & Tasarım
        İhtiyaç Analizi       :done,    des1, 2026-08-01, 2026-08-05
        Mermaid UX Tasarımı   :done,    des2, 2026-08-06, 2026-08-10
    section Geliştirme
        Mermaid Modalı & Editör :active, dev1, 2026-08-11, 2026-08-18
        CodeMirror Widget Entegrasyonu : dev2, 2026-08-18, 2026-08-22
    section Test & Yayın
        A11y & Performans Testleri   : test1, 2026-08-23, 2026-08-25
        Canlıya Dağıtım              : milestone, 2026-08-26, 0d`,
  },
  {
    id: 'gitgraph',
    name: 'Git Graph (Versiyon Dal Akışı)',
    nameTr: 'Git Dal Akışı (GitGraph)',
    icon: 'GitBranch',
    category: 'timeline',
    code: `gitGraph
    commit id: "v1.0.0"
    branch develop
    checkout develop
    commit id: "feat: live-preview"
    branch feat/mermaid
    checkout feat/mermaid
    commit id: "add: mermaid-modal"
    commit id: "feat: autocomplete"
    checkout develop
    merge feat/mermaid tag: "v1.1.0-beta"
    checkout main
    merge develop tag: "v1.1.0"`,
  },
  {
    id: 'mindmap',
    name: 'Mindmap (Zihin Haritası)',
    nameTr: 'Zihin Haritası (Mindmap)',
    icon: 'Brain',
    category: 'other',
    code: `mindmap
  root((HAN Notes))
    Editor Motoru
      CodeMirror 6
      Live Preview
      Markdown & Wikilinks
    Görselleştirme
      YADA Diyagram
      Excalidraw Çizim
      Mermaid.js
    Yapay Zeka
      Inline AI Composer
      Yerel LLM Desteği
    Organizasyon
      Görev Çizelgesi
      Karar Kayıtları (ADR)
      Etiketleme`,
  },
  {
    id: 'pie',
    name: 'Pie Chart (Pasta Grafik)',
    nameTr: 'Pasta Grafik (Pie Chart)',
    icon: 'PieChart',
    category: 'data',
    code: `pie title Not Dağılım İstatistikleri
    "Mimari & Tasarım" : 42
    "Teknik Dokümantasyon" : 28
    "Toplantı Notları" : 18
    "Kişisel & Fikirler" : 12`,
  },
  {
    id: 'architecture',
    name: 'Architecture (Sistem Mimarisi)',
    nameTr: 'Sistem Mimarisi (Architecture)',
    icon: 'Cpu',
    category: 'structure',
    code: `flowchart TB
    subgraph Clients["💻 İstemciler (Clients)"]
        Desktop["🖥️ Masaüstü Uygulaması (Tauri)"]
        Web["📱 Web & PWA İstemcisi"]
    end

    subgraph Gateway["🛡️ Güvenlik & Yönlendirme"]
        APIGateway["🌐 API Gateway & Reverse Proxy"]
        AuthService["🔐 Kimlik Doğrulama Servisi (Auth)"]
    end

    subgraph Backend["⚡ Uygulama Servisleri"]
        NoteService["📝 Not & Doküman Servisi"]
        SearchService["🔍 Vektörel Arama Motoru (AI)"]
        SyncService["🔄 Senkronizasyon Motoru"]
    end

    subgraph Storage["🗄️ Veri & Depolama Katmanı"]
        MainDB[("🐘 PostgreSQL Veritabanı")]
        CacheStore[("⚡ Redis Önbellek")]
        FileStore[("📦 Nesne Deposu (S3 / GCS)")]
    end

    Clients --> APIGateway
    APIGateway --> AuthService
    APIGateway --> NoteService
    APIGateway --> SearchService
    APIGateway --> SyncService

    NoteService --> MainDB
    NoteService --> CacheStore
    SearchService --> MainDB
    SyncService --> FileStore

    classDef clientGroup fill:#8b5cf612,stroke:#8b5cf6,stroke-width:2px;
    classDef gateGroup fill:#0284c712,stroke:#0284c7,stroke-width:2px;
    classDef backGroup fill:#10b98112,stroke:#10b981,stroke-width:2px;
    classDef storeGroup fill:#f59e0b12,stroke:#f59e0b,stroke-width:2px;

    class Clients clientGroup;
    class Gateway gateGroup;
    class Backend backGroup;
    class Storage storeGroup;`,
  },
];
