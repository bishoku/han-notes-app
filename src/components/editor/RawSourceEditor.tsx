/**
 * RawSourceEditor.tsx — Pure, clean, lightweight plain-text Markdown code editor.
 * Renders notes exactly as written with line numbers, code folding, active line highlight,
 * and pure monospace typography (VS Code / Sublime style). Zero widgets, zero hidden DOM lines.
 */
import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { hanHighlightStyle, hanHighlightStyleDark } from '@/editor/hanHighlightStyle';
import { rawAutocomplete } from '@/editor/WikilinkCompletion';
import { smartPastePlugin } from '@/editor/pastePlugin';
import type { FontSize } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface RawSourceEditorProps {
  value: string;
  onChange: (val: string) => void;
  editorRef?: React.Ref<any>;
  theme: string;
  fontSize?: FontSize;
}

export const RawSourceEditor: React.FC<RawSourceEditorProps> = ({
  value,
  onChange,
  editorRef,
  theme,
  fontSize = 'md',
}) => {
  const isDarkTheme = ['dark', 'dracula', 'synthwave'].includes(theme);

  const extensions = useMemo(() => {
    const activeHighlightStyle = isDarkTheme ? hanHighlightStyleDark : hanHighlightStyle;

    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter(),
      bracketMatching(),
      closeBrackets(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(activeHighlightStyle),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      rawAutocomplete,
      smartPastePlugin,
    ];
  }, [isDarkTheme]);

  return (
    <div className="w-full h-full flex-1 overflow-y-auto bg-mac-mainLight dark:bg-mac-mainDark font-mono selection:bg-mac-accent/30 py-6 px-4 md:px-8">
      <div className="w-full cm-raw-source-container">
        <CodeMirror
          value={value}
          onChange={onChange}
          onCreateEditor={(view) => {
            if (editorRef) {
              (editorRef as React.MutableRefObject<any>).current = view;
            }
          }}
          extensions={extensions}
          basicSetup={false}
          theme={isDarkTheme ? 'dark' : 'light'}
          className={cn(
            "cm-raw-editor border border-gray-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-xs bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xs",
            fontSize === 'sm' && "cm-fontsize-sm",
            fontSize === 'md' && "cm-fontsize-md",
            fontSize === 'lg' && "cm-fontsize-lg"
          )}
        />
      </div>
    </div>
  );
};
