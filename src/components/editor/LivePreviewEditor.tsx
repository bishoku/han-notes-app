/**
 * LivePreviewEditor.tsx — Rich interactive WYSIWYG Live Preview editor.
 * Features live table widgets, mermaid diagrams, resizable images, interactive
 * task checkboxes, decision badges, floating block menus, slash commands, and bubble menus.
 */
import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { hanHighlightStyle, hanHighlightStyleDark } from '@/editor/hanHighlightStyle';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { FontSize } from '@/store/uiStore';
import type { NoteInfo } from '@/store/noteStore';

// Editor Plugins & Formatter Utilities
import { livePreviewPlugin } from '@/editor/LivePreviewPlugin';
import { previewAutocomplete } from '@/editor/WikilinkCompletion';
import { smartPastePlugin } from '@/editor/pastePlugin';
import { buildSlashCommands } from '@/editor/slashCommands';
import { applyTextFormat } from '@/editor/formatters';

// Floating UI Hook & Menus
import { useEditorFloatingUI } from '@/hooks/useEditorFloatingUI';
import { FloatingBlockMenu } from '@/components/FloatingBlockMenu';
import { SelectionBubbleMenu, type FormatType } from '@/components/SelectionBubbleMenu';
import { SlashCommandMenu } from '@/components/SlashCommandMenu';
import { EmojiPickerPopover } from '@/components/ui/EmojiPickerPopover';

interface LivePreviewEditorProps {
  value: string;
  onChange: (val: string) => void;
  editorRef: React.RefObject<any>;
  theme: string;
  fontSize?: FontSize;
  currentNoteId: string;
  otherNotes: NoteInfo[];
  onOpenDiagramEditor: () => void;
  onOpenExcalidrawEditor: () => void;
  onOpenImagePicker: () => void;
  onOpenTaskModal: (btnData: any) => void;
  onOpenDecisionModal: (btnData: any) => void;
  onOpenMermaidModal: () => void;
  onOpenCodeModal: (lang?: string) => void;
  onOpenInlineAi: (top: number, lineFrom?: number) => void;
}

export const LivePreviewEditor: React.FC<LivePreviewEditorProps> = ({
  value,
  onChange,
  editorRef,
  theme,
  fontSize = 15,
  currentNoteId: _currentNoteId,
  otherNotes,
  onOpenDiagramEditor,
  onOpenExcalidrawEditor,
  onOpenImagePicker,
  onOpenTaskModal,
  onOpenDecisionModal,
  onOpenMermaidModal,
  onOpenCodeModal,
  onOpenInlineAi,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // 1. Floating UI Hook
  const {
    menuPos,
    showOptions,
    setShowOptions,
    showNotePicker,
    setShowNotePicker,
    taskEditBtn,
    decisionEditBtn,
    selectionBubble,
    slashMenuState,
    setSlashMenuState,
    slashStateRef,
    handleEditorUpdate,
  } = useEditorFloatingUI(wrapperRef, 'preview');

  // Stable ref for menuPos — avoids recreating insertText on every cursor movement
  const menuPosRef = useRef(menuPos);
  menuPosRef.current = menuPos;

  // Helper to insert text at current menu or cursor position
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const targetPos = menuPosRef.current.lineFrom !== undefined ? menuPosRef.current.lineFrom : view.state.selection.main.head;
      view.dispatch({
        changes: { from: targetPos, insert: text },
        selection: { anchor: targetPos + text.length },
      });
      view.focus();
      setShowOptions(false);
      setShowNotePicker(false);
    }
  }, [editorRef, setShowOptions, setShowNotePicker]);

  // Scroll-to-heading: listen for clicks on outline items in RightPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      const view = editorRef.current;
      if (!view) return;
      const lineNum = e.detail.line + 1; // outline uses 0-indexed, CodeMirror doc uses 1-indexed
      const doc = view.state.doc;
      if (lineNum < 1 || lineNum > doc.lines) return;
      const line = doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 80 }),
      });
      view.focus();
    };
    window.addEventListener('scroll-to-heading', handler as EventListener);
    return () => window.removeEventListener('scroll-to-heading', handler as EventListener);
  }, [editorRef]);

  // Slash Commands Executor
  const executeSlashCommand = useCallback((text: string, opts?: { cursorOffset?: number; openTagModal?: boolean }) => {
    if (!editorRef.current) return;
    const view = editorRef.current;
    const slashState = slashStateRef.current;
    if (!slashState.show) return;

    const from = slashState.slashFrom;
    const to = slashState.slashTo || view.state.selection.main.head;
    const insertText = text || '';
    const cursorOffset = opts?.cursorOffset ?? insertText.length;

    view.dispatch({
      changes: { from, to, insert: insertText },
      selection: { anchor: from + cursorOffset },
    });
    view.focus();
    setSlashMenuState({ show: false, query: '', slashFrom: 0, slashTo: 0, anchorRect: { top: 0, left: 0, bottom: 0 } });
  }, [editorRef, slashStateRef, setSlashMenuState]);

  const slashCommands = useMemo(
    () =>
      buildSlashCommands(
        executeSlashCommand,
        onOpenImagePicker,
        onOpenDiagramEditor,
        onOpenExcalidrawEditor,
        () => setEmojiPickerOpen(true),
        onOpenMermaidModal,
        onOpenCodeModal,
        t
      ),
    [
      executeSlashCommand,
      onOpenImagePicker,
      onOpenDiagramEditor,
      onOpenExcalidrawEditor,
      onOpenMermaidModal,
      onOpenCodeModal,
      t,
    ]
  );

  // Text Formatting Handler (delegates to pure formatter utility)
  const handleFormat = useCallback((type: FormatType, payload?: string) => {
    if (!editorRef.current) return;
    applyTextFormat(editorRef.current, selectionBubble, type, payload);
  }, [editorRef, selectionBubble]);

  // CodeMirror Extensions Memo
  const isDarkTheme = ['dark', 'dracula', 'synthwave'].includes(theme);
  const extensions = useMemo(() => {
    const activeHighlightStyle = isDarkTheme ? hanHighlightStyleDark : hanHighlightStyle;
    return [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(activeHighlightStyle),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      smartPastePlugin,
      previewAutocomplete,
      livePreviewPlugin,
    ];
  }, [isDarkTheme]);

  return (
    <div className="flex-1 overflow-y-auto bg-mac-mainLight dark:bg-mac-mainDark relative overscroll-contain">
      <div
        ref={wrapperRef}
        className="py-12 relative pr-8 md:pr-12 pl-14 cm-preview-mode"
      >
        <FloatingBlockMenu
          menuPos={menuPos}
          showOptions={showOptions}
          showNotePicker={showNotePicker}
          taskEditBtn={taskEditBtn}
          decisionEditBtn={decisionEditBtn}
          notes={otherNotes}
          onToggleOptions={() => { setShowOptions(!showOptions); setShowNotePicker(false); }}
          onToggleNotePicker={() => setShowNotePicker(!showNotePicker)}
          onInsertText={insertText}
          onOpenTaskModal={() => onOpenTaskModal(taskEditBtn)}
          onOpenDecisionModal={() => onOpenDecisionModal(decisionEditBtn)}
          onOpenImagePicker={onOpenImagePicker}
          onOpenDiagramEditor={onOpenDiagramEditor}
          onOpenExcalidrawEditor={onOpenExcalidrawEditor}
          onOpenInlineAi={() => onOpenInlineAi(menuPos.top, menuPos.lineFrom)}
        />

        <SelectionBubbleMenu
          bubbleState={selectionBubble}
          onFormat={handleFormat}
        />

        <CodeMirror
          value={value}
          onChange={onChange}
          onCreateEditor={(view) => {
            if (editorRef) {
              (editorRef as React.MutableRefObject<any>).current = view;
            }
          }}
          onUpdate={handleEditorUpdate}
          extensions={extensions}
          theme={isDarkTheme ? 'dark' : 'light'}
          className={cn(
            "text-gray-800 dark:text-gray-200 cm-theme-han",
            fontSize === 'sm' && "cm-fontsize-sm",
            fontSize === 'md' && "cm-fontsize-md",
            fontSize === 'lg' && "cm-fontsize-lg"
          )}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
        />

        {/* Floating Slash Command Menu */}
        {slashMenuState.show && (
          <SlashCommandMenu
            query={slashMenuState.query}
            anchorRect={slashMenuState.anchorRect}
            commands={slashCommands}
            onClose={() => setSlashMenuState((prev) => ({ ...prev, show: false }))}
          />
        )}

        {/* Visual Emoji Picker Popover */}
        <EmojiPickerPopover
          isOpen={emojiPickerOpen}
          onClose={() => setEmojiPickerOpen(false)}
          onSelectEmoji={(emoji) => insertText(emoji + ' ')}
        />
      </div>
    </div>
  );
};
