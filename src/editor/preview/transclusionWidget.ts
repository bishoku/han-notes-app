import { WidgetType, Decoration } from "@codemirror/view";
import { storage } from "@/services/storage";
import type { DecItem } from "./types";

export class TransclusionWidget extends WidgetType {
  private noteId: string;
  private heading: string | null;

  constructor(noteId: string, heading: string | null = null) {
    super();
    this.noteId = noteId;
    this.heading = heading;
  }

  eq(other: TransclusionWidget): boolean {
    return this.noteId === other.noteId && this.heading === other.heading;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "han-transclusion-embed border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl my-4 overflow-hidden";
    
    // Header
    const header = document.createElement("div");
    header.className = "px-4 py-2 bg-gray-100 dark:bg-zinc-700 border-b border-gray-200 dark:border-zinc-700 font-semibold cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-between";
    header.innerText = this.noteId + (this.heading ? `#${this.heading}` : "");
    header.addEventListener("click", () => {
      // Dispatch a custom event that the app can listen to for navigation
      window.dispatchEvent(new CustomEvent('han-navigate-note', { detail: { noteId: this.noteId } }));
    });
    
    // Link Icon
    const linkIcon = document.createElement("span");
    linkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    header.appendChild(linkIcon);
    
    container.appendChild(header);

    // Content area
    const contentArea = document.createElement("div");
    contentArea.className = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans";
    contentArea.innerText = "Loading...";
    container.appendChild(contentArea);

    // Load content asynchronously
    storage.readNote(this.noteId)
      .then(content => {
        let displayContent = content;
        
        // Strip frontmatter
        if (displayContent.startsWith('---')) {
          const match = displayContent.match(/^---\n[\s\S]*?\n---\n/);
          if (match) {
            displayContent = displayContent.substring(match[0].length);
          }
        }

        // Basic heading extraction if needed
        if (this.heading) {
          const lines = displayContent.split('\n');
          let inSection = false;
          let sectionContent = [];
          const targetHeading = this.heading.toLowerCase().trim();
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
            
            if (headingMatch) {
              const currentHeading = headingMatch[2].toLowerCase().trim();
              if (inSection) {
                   break;
              } else if (currentHeading === targetHeading) {
                inSection = true;
                sectionContent.push(line);
                continue;
              }
            }
            
            if (inSection) {
              sectionContent.push(line);
            }
          }
          
          if (sectionContent.length > 0) {
            displayContent = sectionContent.join('\n');
          } else {
            displayContent = `Section #${this.heading} not found.`;
          }
        }

        displayContent = displayContent.trim();
        if (!displayContent) {
          displayContent = "*(Empty note)*";
        }
        
        contentArea.innerText = displayContent;
      })
      .catch(() => {
        contentArea.innerText = "Note not found.";
        contentArea.className = "px-4 py-3 text-sm text-red-500 italic";
      });

    return container;
  }
}

export function processTransclusionBlock(
  line: any,
  collect: (item: DecItem) => void
): boolean {
  const text = line.text.trim();
  
  const match = text.match(/^!\[\[([^\]]+)\]\]$/);
  if (match) {
    const fullPath = match[1];
    let noteId = fullPath;
    let heading = null;
    
    const hashIndex = fullPath.indexOf('#');
    if (hashIndex !== -1) {
      noteId = fullPath.substring(0, hashIndex);
      heading = fullPath.substring(hashIndex + 1);
    }
    
    collect({
      from: line.from,
      to: line.to,
      dec: Decoration.replace({
        widget: new TransclusionWidget(noteId, heading),
        block: true
      })
    });
    
    return true;
  }
  
  return false;
}
