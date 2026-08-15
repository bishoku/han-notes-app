import { Decoration, WidgetType } from "@codemirror/view";

export const CALLOUT_ICONS: Record<string, string> = {
  NOTE: "ℹ️",
  TIP: "💡",
  IMPORTANT: "🟣",
  WARNING: "⚠️",
  CAUTION: "🚨",
};

export const calloutLineDecs: Record<string, { header: Decoration; body: Decoration; single: Decoration }> = {
  NOTE: {
    header: Decoration.line({ attributes: { class: "cm-callout-header cm-callout-note" } }),
    body: Decoration.line({ attributes: { class: "cm-callout-body cm-callout-note" } }),
    single: Decoration.line({ attributes: { class: "cm-callout-single cm-callout-note" } }),
  },
  TIP: {
    header: Decoration.line({ attributes: { class: "cm-callout-header cm-callout-tip" } }),
    body: Decoration.line({ attributes: { class: "cm-callout-body cm-callout-tip" } }),
    single: Decoration.line({ attributes: { class: "cm-callout-single cm-callout-tip" } }),
  },
  IMPORTANT: {
    header: Decoration.line({ attributes: { class: "cm-callout-header cm-callout-important" } }),
    body: Decoration.line({ attributes: { class: "cm-callout-body cm-callout-important" } }),
    single: Decoration.line({ attributes: { class: "cm-callout-single cm-callout-important" } }),
  },
  WARNING: {
    header: Decoration.line({ attributes: { class: "cm-callout-header cm-callout-warning" } }),
    body: Decoration.line({ attributes: { class: "cm-callout-body cm-callout-warning" } }),
    single: Decoration.line({ attributes: { class: "cm-callout-single cm-callout-warning" } }),
  },
  CAUTION: {
    header: Decoration.line({ attributes: { class: "cm-callout-header cm-callout-caution" } }),
    body: Decoration.line({ attributes: { class: "cm-callout-body cm-callout-caution" } }),
    single: Decoration.line({ attributes: { class: "cm-callout-single cm-callout-caution" } }),
  },
};

export class IconWidget extends WidgetType {
  private icon: string;
  private type: string;
  private pos: number;

  constructor(icon: string, type: string, pos: number) {
    super();
    this.icon = icon;
    this.type = type;
    this.pos = pos;
  }

  eq(other: IconWidget) {
    return (
      other.icon === this.icon &&
      other.type === this.type &&
      other.pos === this.pos
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className =
      "cm-callout-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold mr-2 select-none cursor-pointer hover:opacity-80 transition-opacity bg-black/5 dark:bg-white/10";
    span.setAttribute("data-callout-pos", String(this.pos));
    span.setAttribute("data-callout-type", this.type);
    span.title = "Tıkla: Callout türünü değiştir (NOTE -> TIP -> WARNING -> IMPORTANT -> CAUTION)";
    span.textContent = `${this.icon} ${this.type}`;
    return span;
  }
}
