import { WidgetType } from "@codemirror/view";

export class DiagramBadgeWidget extends WidgetType {
  diagramId: string;

  constructor(diagramId: string) {
    super();
    this.diagramId = diagramId;
  }

  eq(other: DiagramBadgeWidget) {
    return this.diagramId === other.diagramId;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors mx-1 select-none";
    span.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 9h6v6H9z"></path>
        <path d="M9 15v6H3v-6h6z"></path>
        <path d="M21 9v6h-6V9h6z"></path>
        <path d="M9 3v6H3V3h6z"></path>
      </svg>
      Diyagramı Düzenle
    `;

    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('edit-diagram', { detail: this.diagramId }));
    };

    return span;
  }
}
