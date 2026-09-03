import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

import { useUiStore } from '@/store/uiStore';
import { renderMermaidSvg, validateMermaid } from '@/editor/mermaid/mermaidService';
import { mermaidAutocomplete } from '@/editor/mermaid/mermaidCompletion';
import { MERMAID_TEMPLATES, type MermaidTemplate } from '@/editor/mermaid/mermaidTemplates';
import { cn } from '@/lib/utils';

import { MermaidToolbar } from './mermaid/MermaidToolbar';
import { MermaidPreviewCanvas } from './mermaid/MermaidPreviewCanvas';
import { MermaidSnippetChips } from './mermaid/MermaidSnippetChips';
import { MermaidModalFooter } from './mermaid/MermaidModalFooter';

export interface MermaidSavePayload {
  code: string;
  width?: number | null;
  from?: number;
  to?: number;
}

interface MermaidEditorModalProps {
  isOpen: boolean;
  initialCode?: string;
  code?: string;
  width?: number | null;
  from?: number;
  to?: number;
  onClose: () => void;
  onSave: (payload: MermaidSavePayload) => void;
}

const DEFAULT_CODE = MERMAID_TEMPLATES[0].code;

export const MermaidEditorModal: React.FC<MermaidEditorModalProps> = ({
  isOpen,
  initialCode,
  code: propCode,
  width,
  from,
  to,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = ['dark', 'dracula', 'synthwave'].includes(theme);

  const isEditing = from !== undefined && to !== undefined;
  const rawCode = initialCode !== undefined ? initialCode : propCode;
  const resolvedCode = rawCode !== undefined ? rawCode.trim() : (isEditing ? '' : DEFAULT_CODE);

  const [code, setCode] = useState<string>(resolvedCode || (isEditing ? '' : DEFAULT_CODE));
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);

  // View Layout Modes: 'split' | 'code' | 'preview'
  const [layoutMode, setLayoutMode] = useState<'split' | 'code' | 'preview'>('split');
  const [bgMode, setBgMode] = useState<'theme' | 'light' | 'dark' | 'grid'>('theme');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState<boolean>(false);

  const editorViewRef = useRef<any>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // Sync initial code when modal opens or code changes
  useEffect(() => {
    if (isOpen) {
      setCode(resolvedCode || (isEditing ? '' : DEFAULT_CODE));
      setZoomLevel(1);
      setSyntaxError(null);
      setBgMode('theme');
    }
  }, [isOpen, resolvedCode, isEditing]);

  // Close template menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    if (showTemplateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplateDropdown]);

  // Debounced Render Function
  const renderCurrentDiagram = useCallback(
    async (currentCode: string) => {
      if (!currentCode.trim()) {
        setRenderedSvg('');
        setSyntaxError(null);
        return;
      }

      setIsRendering(true);
      const validation = await validateMermaid(currentCode);
      if (!validation.valid) {
        setSyntaxError(validation.error || t('syntaxError'));
        setIsRendering(false);
        return;
      }

      setSyntaxError(null);
      const result = await renderMermaidSvg('modal-preview', currentCode, isDark);

      if (result.error) {
        setSyntaxError(result.error);
      } else {
        setRenderedSvg(result.svg);
      }
      setIsRendering(false);
    },
    [isDark, t]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    renderTimeoutRef.current = setTimeout(() => {
      renderCurrentDiagram(code);
    }, 280);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [code, isDark, isOpen, renderCurrentDiagram]);

  const handleApplyTemplate = (tpl: MermaidTemplate) => {
    setCode(tpl.code);
    setShowTemplateDropdown(false);
  };

  const handleInsertSnippet = (snippet: string) => {
    if (!editorViewRef.current) {
      setCode((prev) => prev + '\n' + snippet);
      return;
    }
    const view = editorViewRef.current;
    const { from: curFrom, to: curTo } = view.state.selection.main;
    view.dispatch({
      changes: { from: curFrom, to: curTo, insert: snippet },
      selection: { anchor: curFrom + snippet.length },
    });
    view.focus();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignored
    }
  };

  const handleCopySvg = async () => {
    if (!renderedSvg) return;
    try {
      await navigator.clipboard.writeText(renderedSvg);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1800);
    } catch {
      // Ignored
    }
  };

  const handleSave = () => {
    onSave({
      code: code.trim(),
      width,
      from,
      to,
    });
    onClose();
  };

  const editorExtensions = useMemo(() => [
    EditorView.lineWrapping,
    mermaidAutocomplete,
  ], []);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1550px] h-[92vh] max-h-[920px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <MermaidToolbar
          isEditing={isEditing}
          showTemplateDropdown={showTemplateDropdown}
          onToggleTemplateDropdown={() => setShowTemplateDropdown(!showTemplateDropdown)}
          onSelectTemplate={handleApplyTemplate}
          templateMenuRef={templateMenuRef}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
          onClose={onClose}
        />

        {/* ─── Modal Main Body ─── */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left / Code Panel */}
          {(layoutMode === 'code' || layoutMode === 'split') && (
            <div
              className={cn(
                'flex flex-col border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 transition-all',
                layoutMode === 'split' ? 'w-1/2' : 'w-full'
              )}
            >
              <MermaidSnippetChips onInsertSnippet={handleInsertSnippet} />

              {/* CodeMirror Workspace */}
              <div className="flex-1 overflow-y-auto font-mono text-xs">
                <CodeMirror
                  value={code}
                  onChange={(val) => setCode(val)}
                  onCreateEditor={(view) => {
                    editorViewRef.current = view;
                  }}
                  theme={isDark ? 'dark' : 'light'}
                  extensions={editorExtensions}
                  className="h-full"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    indentOnInput: true,
                    highlightActiveLine: true,
                  }}
                />
              </div>

              {/* Syntax Error Notice Footer */}
              {syntaxError && (
                <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="font-medium truncate">{syntaxError}</span>
                </div>
              )}
            </div>
          )}

          {/* Right / Live Preview Panel */}
          {(layoutMode === 'preview' || layoutMode === 'split') && (
            <div
              className={cn(
                'flex flex-col bg-slate-50 dark:bg-zinc-950 relative overflow-hidden transition-all',
                layoutMode === 'split' ? 'w-1/2' : 'w-full'
              )}
            >
              <MermaidPreviewCanvas
                isRendering={isRendering}
                renderedSvg={renderedSvg}
                syntaxError={syntaxError}
                bgMode={bgMode}
                onChangeBgMode={setBgMode}
                zoomLevel={zoomLevel}
                onZoomIn={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.15))}
                onZoomOut={() => setZoomLevel((prev) => Math.max(0.4, prev - 0.15))}
                onResetZoom={() => setZoomLevel(1)}
              />
            </div>
          )}
        </div>

        <MermaidModalFooter
          code={code}
          syntaxError={syntaxError}
          renderedSvg={renderedSvg}
          copiedCode={copiedCode}
          copiedSvg={copiedSvg}
          isEditing={isEditing}
          onCopyCode={handleCopyCode}
          onCopySvg={handleCopySvg}
          onClose={onClose}
          onSave={handleSave}
        />
      </div>
    </div>,
    document.body
  );
};
