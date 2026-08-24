import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { useTranslation } from 'react-i18next';
import {
  X,
  Check,
  Copy,
  AlertCircle,
  Sun,
  Moon,
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Columns,
  Code2,
  Eye,
  GitFork,
  Database,
  Layers,
  Activity,
  Calendar,
  GitBranch,
  Brain,
  PieChart,
  Cpu,
  ArrowRightLeft,
} from 'lucide-react';

import { useUiStore } from '@/store/uiStore';
import { renderMermaidSvg, validateMermaid } from '@/editor/mermaid/mermaidService';
import { mermaidAutocomplete } from '@/editor/mermaid/mermaidCompletion';
import { MERMAID_TEMPLATES, type MermaidTemplate } from '@/editor/mermaid/mermaidTemplates';
import { cn } from '@/lib/utils';

export interface MermaidSavePayload {
  code: string;
  width?: number | null;
  from?: number;
  to?: number;
}

interface MermaidEditorModalProps {
  isOpen: boolean;
  initialCode?: string;
  width?: number | null;
  from?: number;
  to?: number;
  onClose: () => void;
  onSave: (payload: MermaidSavePayload) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  flowchart: <GitFork size={13} className="text-teal-500 shrink-0" />,
  sequence: <ArrowRightLeft size={13} className="text-blue-500 shrink-0" />,
  class: <Layers size={13} className="text-indigo-500 shrink-0" />,
  state: <Activity size={13} className="text-amber-500 shrink-0" />,
  er: <Database size={13} className="text-emerald-500 shrink-0" />,
  gantt: <Calendar size={13} className="text-rose-500 shrink-0" />,
  gitgraph: <GitBranch size={13} className="text-violet-500 shrink-0" />,
  mindmap: <Brain size={13} className="text-fuchsia-500 shrink-0" />,
  pie: <PieChart size={13} className="text-orange-500 shrink-0" />,
  architecture: <Cpu size={13} className="text-cyan-500 shrink-0" />,
};

const DEFAULT_CODE = MERMAID_TEMPLATES[0].code;

export const MermaidEditorModal: React.FC<MermaidEditorModalProps> = ({
  isOpen,
  initialCode,
  width,
  from,
  to,
  onClose,
  onSave,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = ['dark', 'dracula', 'synthwave'].includes(theme);

  const [code, setCode] = useState<string>(initialCode?.trim() || DEFAULT_CODE);
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

  const isEditing = from !== undefined && to !== undefined;

  // Sync initial code when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode(initialCode?.trim() || DEFAULT_CODE);
      setZoomLevel(1);
      setSyntaxError(null);
      setBgMode('theme');
    }
  }, [isOpen, initialCode]);

  // Click outside to close template menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    if (showTemplateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateDropdown]);

  // Debounced Live SVG Rendering & Validation
  const updatePreview = useCallback(async (currentCode: string) => {
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
  }, [isDark]);

  useEffect(() => {
    if (!isOpen) return;

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(() => {
      updatePreview(code);
    }, 250);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [code, isOpen, updatePreview]);

  // Keyboard Shortcuts: Esc to close, Cmd+Enter / Ctrl+Enter to save
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSave = () => {
    if (!code.trim()) return;
    onSave({
      code: code.trim(),
      width,
      from,
      to,
    });
    onClose();
  };

  const handleApplyTemplate = (tpl: MermaidTemplate) => {
    setCode(tpl.code);
    setShowTemplateDropdown(false);
    if (editorViewRef.current) {
      editorViewRef.current.focus();
    }
  };

  const handleInsertSnippet = (snippetText: string) => {
    if (editorViewRef.current) {
      const view = editorViewRef.current;
      const { from: selFrom, to: selTo } = view.state.selection.main;
      view.dispatch({
        changes: { from: selFrom, to: selTo, insert: snippetText },
        selection: { anchor: selFrom + snippetText.length },
      });
      view.focus();
    } else {
      setCode((prev) => prev + '\n' + snippetText);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  const handleCopySvg = async () => {
    if (!renderedSvg) return;
    try {
      await navigator.clipboard.writeText(renderedSvg);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1800);
    } catch (err) {
      console.error('Failed to copy SVG', err);
    }
  };

  const editorExtensions = useMemo(() => {
    return [
      EditorView.lineWrapping,
      mermaidAutocomplete,
    ];
  }, []);

  const getCanvasBgClass = () => {
    switch (bgMode) {
      case 'light':
        return 'bg-white text-zinc-900';
      case 'dark':
        return 'bg-zinc-950 text-zinc-100';
      case 'grid':
        return 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200';
      case 'theme':
      default:
        return 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200';
    }
  };

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
        {/* ─── Modal Header ─── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/90 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 shadow-xs">
              <GitFork size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-2">
                {t('mermaidEditorTitle', 'Mermaid Diyagram Editörü')}
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/40">
                  {isEditing ? t('edit', 'Düzenle') : t('newDiagram', 'Yeni Diyagram')}
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Template Selector */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={templateMenuRef}>
              <button
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span>{t('mermaidTemplates', 'Hazır Şablonlar')}</span>
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-10 right-0 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t('selectTemplate', 'Şablon Seçin')}
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-0.5">
                    {MERMAID_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition-colors cursor-pointer"
                      >
                        {TEMPLATE_ICONS[tpl.id] || <GitFork size={13} />}
                        <span className="truncate">{i18n.language === 'tr' ? tpl.nameTr : tpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Layout Mode Switcher */}
            <div className="flex items-center bg-gray-200/70 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('code')}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  layoutMode === 'code' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200"
                )}
                title={t('statusEditorRaw')}
              >
                <Code2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  layoutMode === 'split' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200"
                )}
                title={t('codeEditorTitle')}
              >
                <Columns size={14} />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('preview')}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  layoutMode === 'preview' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-200"
                )}
                title={t('statusEditorPreview')}
              >
                <Eye size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded-lg hover:bg-gray-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={t('close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Modal Main Body ─── */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left / Code Panel */}
          {(layoutMode === 'code' || layoutMode === 'split') && (
            <div
              className={cn(
                "flex flex-col border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 transition-all",
                layoutMode === 'split' ? "w-1/2" : "w-full"
              )}
            >
              {/* Quick Helper Chips Bar */}
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100/60 dark:bg-zinc-800/40 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto text-[11px]">
                <span className="text-gray-400 font-medium shrink-0">{t('quickInsert')}</span>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('--> ')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  {"-->"}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('subgraph GroupName [Title]\n    A --> B\nend\n')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  subgraph
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('[(Database)]')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  [(DB)]
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('{Decision?}')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  {'{Decision}'}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('([Stadium])')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  ([Pill])
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSnippet('classDef highlight fill:#3b82f620,stroke:#3b82f6,stroke-width:2px;\n')}
                  className="px-2 py-0.5 bg-white dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-300 hover:text-teal-600 rounded border border-gray-200 dark:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                >
                  classDef
                </button>
              </div>

              {/* CodeMirror Workspace */}
              <div className="flex-1 overflow-y-auto font-mono text-xs">
                <CodeMirror
                  value={code}
                  onChange={(val) => setCode(val)}
                  onCreateEditor={(view) => { editorViewRef.current = view; }}
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
                "flex flex-col bg-slate-50 dark:bg-zinc-950 relative overflow-hidden transition-all",
                layoutMode === 'split' ? "w-1/2" : "w-full"
              )}
            >
              {/* Preview Controls Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Eye size={13} className="text-teal-500" />
                  <span className="font-medium">{t('mermaidLivePreview')}</span>
                  {isRendering && (
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 animate-pulse ml-2 font-medium">
                      {t('loading')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Canvas Background Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-full p-0.5 border border-gray-200 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => setBgMode('light')}
                      className={cn(
                        "p-1 rounded-full transition-colors cursor-pointer",
                        bgMode === 'light' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                      )}
                      title={t('themeLight')}
                    >
                      <Sun size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgMode('dark')}
                      className={cn(
                        "p-1 rounded-full transition-colors cursor-pointer",
                        bgMode === 'dark' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                      )}
                      title={t('themeDark')}
                    >
                      <Moon size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgMode('grid')}
                      className={cn(
                        "p-1 rounded-full transition-colors cursor-pointer",
                        bgMode === 'grid' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs" : "text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                      )}
                      title="Grid"
                    >
                      <Grid size={12} />
                    </button>
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-gray-200 dark:border-zinc-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((prev) => Math.max(0.4, prev - 0.15))}
                      className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                      title={t('zoomOut')}
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="px-1.5 text-[11px] font-mono text-gray-600 dark:text-gray-300">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.15))}
                      className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                      title={t('zoomIn')}
                    >
                      <ZoomIn size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer ml-0.5"
                      title={t('reset')}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rendered SVG Display Area */}
              <div
                className={cn(
                  "flex-1 overflow-auto flex items-center justify-center p-6 transition-colors duration-200 select-none",
                  getCanvasBgClass()
                )}
              >
                {renderedSvg ? (
                  <div
                    className="transition-transform duration-100 flex items-center justify-center max-w-full"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-2">
                    <GitFork size={32} className="opacity-40 animate-pulse" />
                    <span className="text-xs">
                      {syntaxError ? t('fixSyntaxError') : t('previewPlaceholder')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Modal Footer ─── */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>💡 {t('mermaidTip')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              <Copy size={13} />
              <span>{copiedCode ? t('copied') : t('copyCode')}</span>
            </button>

            {renderedSvg && (
              <button
                type="button"
                onClick={handleCopySvg}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors cursor-pointer"
              >
                <Copy size={13} />
                <span>{copiedSvg ? t('copied') : t('copySvg')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!code.trim() || !!syntaxError}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>{isEditing ? t('updateDiagram') : t('insertDiagram')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
