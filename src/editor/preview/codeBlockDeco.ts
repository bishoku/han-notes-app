import { WidgetType } from "@codemirror/view";

export class CodeCopyButtonWidget extends WidgetType {
  private codeText: string;

  constructor(codeText: string) {
    super();
    this.codeText = codeText;
  }

  eq(other: CodeCopyButtonWidget) {
    return other.codeText === this.codeText;
  }

  toDOM() {
    const btn = document.createElement("button");
    btn.className =
      "inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-white/70 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 px-2 py-0.5 rounded border border-gray-200/70 dark:border-zinc-700/70 shadow-2xs transition-all cursor-pointer select-none ml-auto pointer-events-auto";
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      <span>Copy</span>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.codeText) {
        navigator.clipboard.writeText(this.codeText).then(() => {
          btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
          `;
          setTimeout(() => {
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy</span>
            `;
          }, 2000);
        }).catch((err) => {
          console.error("Failed to copy code:", err);
        });
      }
    });

    return btn;
  }
}
