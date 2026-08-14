import { WidgetType } from "@codemirror/view";

export type CalloutType = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

export interface CalloutData {
  type: CalloutType;
  title: string;
  content: string;
}

const CALLOUT_STYLES: Record<CalloutType, { bgClass: string; borderClass: string; textClass: string; icon: string }> = {
  NOTE: {
    bgClass: "bg-blue-50/60 dark:bg-blue-950/30",
    borderClass: "border-blue-500",
    textClass: "text-blue-700 dark:text-blue-300",
    icon: "ℹ️",
  },
  TIP: {
    bgClass: "bg-emerald-50/60 dark:bg-emerald-950/30",
    borderClass: "border-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-300",
    icon: "💡",
  },
  IMPORTANT: {
    bgClass: "bg-purple-50/60 dark:bg-purple-950/30",
    borderClass: "border-purple-500",
    textClass: "text-purple-700 dark:text-purple-300",
    icon: "🟣",
  },
  WARNING: {
    bgClass: "bg-amber-50/60 dark:bg-amber-950/30",
    borderClass: "border-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    icon: "⚠️",
  },
  CAUTION: {
    bgClass: "bg-red-50/60 dark:bg-red-950/30",
    borderClass: "border-red-500",
    textClass: "text-red-700 dark:text-red-300",
    icon: "🚨",
  },
};

export class CalloutWidget extends WidgetType {
  private data: CalloutData;

  constructor(data: CalloutData) {
    super();
    this.data = data;
  }

  eq(other: CalloutWidget): boolean {
    return (
      other.data.type === this.data.type &&
      other.data.title === this.data.title &&
      other.data.content === this.data.content
    );
  }

  toDOM(): HTMLElement {
    const style = CALLOUT_STYLES[this.data.type] || CALLOUT_STYLES.NOTE;

    const container = document.createElement("div");
    container.className = `my-3 p-3.5 rounded-xl border-l-4 shadow-2xs select-none transition-all ${style.bgClass} ${style.borderClass}`;

    // Header
    const header = document.createElement("div");
    header.className = `flex items-center gap-2 font-bold text-xs uppercase tracking-wide mb-1.5 ${style.textClass}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "text-sm leading-none shrink-0";
    iconSpan.textContent = style.icon;

    const titleSpan = document.createElement("span");
    titleSpan.textContent = this.data.title || this.data.type;

    header.appendChild(iconSpan);
    header.appendChild(titleSpan);
    container.appendChild(header);

    // Body content
    if (this.data.content.trim()) {
      const body = document.createElement("div");
      body.className = "text-xs leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap pl-6";
      body.textContent = this.data.content.trim();
      container.appendChild(body);
    }

    return container;
  }
}
