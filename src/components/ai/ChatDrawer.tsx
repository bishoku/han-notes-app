import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiStore } from '@/store/aiStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import {
  Bot,
  Send,
  Square,
  Trash2,
  X,
  FileText,
  Sparkles,
  CheckSquare,
  ShieldCheck,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  ChevronDown,
  Paperclip,
  Search,
  MessageSquare,
  Edit2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from './MarkdownMessage';

export const ChatDrawer: React.FC = () => {
  const { t } = useTranslation();
  const {
    settings,
    sessions,
    currentSessionId,
    isChatDrawerOpen,
    setChatDrawerOpen,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearChat,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    attachNoteToSession,
    detachNoteFromSession,
  } = useAiStore();

  const { selectNote, notes, currentNoteContent, currentNoteId } = useNoteStore();
  const { setViewMode } = useUiStore();

  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const currentNote = notes.find((n) => n.id === currentNoteId);
  const currentNoteTitle = currentNote?.title || currentNoteId?.split('/').pop() || '';

  // Get current active session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId) || sessions[0];
  }, [sessions, currentSessionId]);

  const currentMessages = useMemo(() => activeSession?.messages || [], [activeSession?.messages]);

  // Filter sessions relevant to the current note scope (or all sessions)
  const relevantSessions = useMemo(() => {
    return sessions.filter((s) => s.noteId === currentNoteId);
  }, [sessions, currentNoteId]);

  // Other notes in vault available to attach
  const availableNotesToAttach = useMemo(() => {
    const attachedSet = new Set(activeSession?.attachedNoteIds || []);
    return notes.filter((n) => {
      if (n.id === currentNoteId) return false; // Already the active note
      if (attachedSet.has(n.id)) return false; // Already attached
      if (!noteSearchQuery.trim()) return true;
      const q = noteSearchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
    });
  }, [notes, currentNoteId, activeSession?.attachedNoteIds, noteSearchQuery]);

  // Resolved list of attached notes objects
  const attachedNotesList = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.attachedNoteIds.map((id) => {
      const found = notes.find((n) => n.id === id);
      return {
        id,
        title: found?.title || id.split('/').pop() || id,
      };
    });
  }, [activeSession, notes]);

  // Auto-scroll to bottom on new messages / chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isStreaming]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (isChatDrawerOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isChatDrawerOpen]);

  // Auto-resize input textarea to comfortably fit content without early scrolling
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 40), 180);
    el.style.height = `${newHeight}px`;
  }, [input]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sessionMenuOpen && sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setSessionMenuOpen(false);
        setEditingSessionId(null);
      }
      if (attachMenuOpen && attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [sessionMenuOpen, attachMenuOpen]);

  if (!isChatDrawerOpen || !settings.enabled) return null;

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenCitation = async (noteId: string) => {
    await selectNote(noteId);
    setViewMode('notes');
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isStreaming) return;
    sendMessage(promptText);
  };

  const handleNewSession = () => {
    createSession(currentNoteId);
    setSessionMenuOpen(false);
  };

  const handleStartRename = (s: typeof activeSession) => {
    if (!s) return;
    setEditingSessionId(s.id);
    setEditingTitle(s.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      renameSession(sessionId, editingTitle);
    }
    setEditingSessionId(null);
  };

  return (
    <aside
      className={cn(
        "h-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-gray-200/80 dark:border-zinc-800/80 flex flex-col z-20 shadow-md shrink-0 transition-all duration-200 select-none",
        isExpanded ? "w-full sm:w-[580px] md:w-[680px]" : "w-80 sm:w-96 md:w-[440px]"
      )}
    >
      {/* 1. Header Bar */}
      <div className="p-3 px-4 border-b border-gray-100 dark:border-zinc-800/80 flex flex-col gap-2.5 bg-gray-50/50 dark:bg-zinc-900/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-mac-accent to-purple-600 text-white shadow-xs">
              <Bot size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                  {t('aiAssistantTitle')}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">
                {settings.model || settings.provider}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewSession}
              className="p-1.5 px-2 rounded-lg bg-mac-accent/10 hover:bg-mac-accent/20 text-mac-accent text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title={t('aiNewSession')}
            >
              <Plus size={13} />
              <span className="hidden sm:inline">{t('aiNewSession')}</span>
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={isExpanded ? t('collapseSidebar') : t('expandSidebar')}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            {currentMessages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title={t('aiClearChat')}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => setChatDrawerOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={t('close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Session Selector & Note Badge Row */}
        <div className="flex items-center justify-between gap-2 relative">
          {/* Session Switcher Popover Trigger */}
          <div className="relative flex-1 min-w-0" ref={sessionMenuRef}>
            <button
              onClick={() => setSessionMenuOpen(!sessionMenuOpen)}
              className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700/80 text-gray-800 dark:text-gray-200 text-xs font-medium transition-colors text-left truncate cursor-pointer border border-gray-200/50 dark:border-zinc-700/50"
            >
              <span className="flex items-center gap-1.5 truncate">
                <MessageSquare size={13} className="text-purple-500 shrink-0" />
                <span className="truncate">{activeSession?.title || t('aiUntitledSession')}</span>
              </span>
              <ChevronDown size={12} className={cn("text-gray-400 shrink-0 transition-transform", sessionMenuOpen && "rotate-180")} />
            </button>

            {/* Session Dropdown Menu */}
            {sessionMenuOpen && (
              <div className="absolute top-10 left-0 w-full min-w-[280px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span>{t('aiSessionHistory')}</span>
                  <button
                    onClick={handleNewSession}
                    className="text-mac-accent hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>{t('aiNewSession')}</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 scrollbar-thin">
                  {relevantSessions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      {t('aiNoSessionsFound')}
                    </div>
                  ) : (
                    relevantSessions.map((s) => {
                      const isActive = s.id === currentSessionId;
                      const isEditing = editingSessionId === s.id;

                      if (isEditing) {
                        return (
                          <div key={s.id} className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(s.id);
                                if (e.key === 'Escape') setEditingSessionId(null);
                              }}
                              className="flex-1 bg-transparent text-xs outline-none px-1 py-0.5 text-gray-900 dark:text-gray-100"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(s.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingSessionId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors group cursor-pointer",
                            isActive
                              ? "bg-mac-accent/15 text-mac-accent font-semibold"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                          )}
                          onClick={() => {
                            switchSession(s.id);
                            setSessionMenuOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <MessageSquare size={12} className={cn(isActive ? "text-mac-accent" : "text-gray-400", "shrink-0")} />
                            <span className="truncate">{s.title}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(s);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded cursor-pointer"
                              title={t('aiRenameSession')}
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(s.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                              title={t('aiDeleteSession')}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Context Badges Bar (Active Note + Attached User Notes + Add Note Button) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Active Open Note Badge */}
          {currentNoteId ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 max-w-[200px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{currentNoteTitle || currentNoteId}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{t('aiGlobalVaultChat')}</span>
            </div>
          )}

          {/* User-Attached Notes Badges */}
          {attachedNotesList.map((attached) => (
            <div
              key={attached.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold border border-purple-500/20 max-w-[180px] truncate group"
            >
              <Paperclip size={10} className="shrink-0" />
              <span className="truncate">{attached.title}</span>
              {activeSession && (
                <button
                  onClick={() => detachNoteFromSession(activeSession.id, attached.id)}
                  className="p-0.5 hover:bg-purple-500/20 rounded text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 cursor-pointer"
                  title={t('aiRemoveAttachedNote')}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {/* Add Note Button & Searchable Popover */}
          <div className="relative inline-block" ref={attachMenuRef}>
            <button
              onClick={() => {
                setAttachMenuOpen(!attachMenuOpen);
                setNoteSearchQuery('');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-purple-500/15 hover:text-purple-600 dark:hover:text-purple-400 text-gray-600 dark:text-gray-400 text-[10px] font-medium border border-gray-200/60 dark:border-zinc-700/60 transition-colors cursor-pointer"
              title={t('aiAttachNote')}
            >
              <Plus size={10} />
              <span>{t('aiAttachNote')}</span>
            </button>

            {/* Note Picker Popover */}
            {attachMenuOpen && (
              <div className="absolute top-7 left-0 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs">
                  <Search size={11} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={noteSearchQuery}
                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                    placeholder={t('aiSearchNoteToAttach')}
                    className="w-full bg-transparent outline-none text-[11px] text-gray-800 dark:text-gray-200 placeholder-gray-400"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 scrollbar-thin">
                  {availableNotesToAttach.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      {t('noResultsFound')}
                    </div>
                  ) : (
                    availableNotesToAttach.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => {
                          if (activeSession) {
                            attachNoteToSession(activeSession.id, note.id);
                          }
                          setAttachMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors cursor-pointer"
                      >
                        <FileText size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate font-medium">{note.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Messages List / Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 text-xs select-text min-w-0">
        {currentMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-mac-accent/10 text-mac-accent flex items-center justify-center mb-3">
              <Sparkles size={24} />
            </div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-1">
              {currentNoteTitle ? `"${currentNoteTitle}" — ${t('aiEmptyTitle')}` : t('aiEmptyTitle')}
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              {t('aiEmptyDesc')}
            </p>

            {/* Quick Action Suggestions */}
            <div className="flex flex-col gap-1.5 w-full">
              {currentNoteId && currentNoteContent && (
                <button
                  onClick={() => handleQuickPrompt(t('aiQuickSummarizePrompt', { title: currentNoteTitle }))}
                  className="w-full text-left p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 hover:bg-mac-accent/10 hover:text-mac-accent text-[11px] text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60 transition-colors flex items-center gap-2 cursor-pointer group"
                >
                  <FileText size={13} className="text-mac-accent shrink-0" />
                  <span className="truncate font-medium">"{currentNoteTitle}" — {t('aiQuickSummarize')}</span>
                </button>
              )}
              <button
                onClick={() => handleQuickPrompt(t('aiQuickTasksPrompt'))}
                className="w-full text-left p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 hover:bg-mac-accent/10 hover:text-mac-accent text-[11px] text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60 transition-colors flex items-center gap-2 cursor-pointer group"
              >
                <CheckSquare size={13} className="text-emerald-500 shrink-0" />
                <span className="truncate">{t('aiQuickTasks')}</span>
              </button>
              <button
                onClick={() => handleQuickPrompt(t('aiQuickDecisionsPrompt'))}
                className="w-full text-left p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 hover:bg-mac-accent/10 hover:text-mac-accent text-[11px] text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60 transition-colors flex items-center gap-2 cursor-pointer group"
              >
                <ShieldCheck size={13} className="text-purple-500 shrink-0" />
                <span className="truncate">{t('aiQuickDecisions')}</span>
              </button>
            </div>
          </div>
        ) : (
          currentMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLast = idx === currentMessages.length - 1;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1.5 w-full min-w-0",
                  isUser ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "p-3.5 rounded-2xl max-w-[96%] min-w-0 overflow-hidden break-words shadow-2xs",
                    isUser
                      ? "bg-mac-accent text-white rounded-br-xs text-xs whitespace-pre-wrap leading-relaxed w-fit"
                      : msg.error
                      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 rounded-bl-xs text-xs w-full"
                      : "bg-gray-100/90 dark:bg-zinc-800/90 text-gray-900 dark:text-gray-100 rounded-bl-xs border border-gray-200/60 dark:border-zinc-700/60 w-full"
                  )}
                >
                  {isUser ? (
                    msg.content
                  ) : msg.content || msg.reasoning ? (
                    <MarkdownMessage
                      content={msg.content}
                      reasoning={msg.reasoning}
                      thinkingTimeMs={msg.thinkingTimeMs}
                      isThinking={isStreaming && isLast && (msg.isThinking || (!msg.content && !!msg.reasoning))}
                      isStreaming={isStreaming && isLast}
                      citations={msg.citations}
                      onCitationClick={handleOpenCitation}
                    />
                  ) : isStreaming && isLast ? (
                    <span className="inline-flex items-center gap-1 text-gray-400 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-mac-accent animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-mac-accent animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-mac-accent animate-bounce [animation-delay:0.4s]" />
                    </span>
                  ) : null}
                </div>

                {/* Citations / Source Notes Badges */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-w-[95%]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 w-full flex items-center gap-1">
                      <Layers size={10} />
                      {t('aiSourceNotes')}:
                    </span>
                    {msg.citations.map((c, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleOpenCitation(c.noteId)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors cursor-pointer group"
                        title={c.snippet}
                      >
                        <FileText size={10} />
                        <span className="font-semibold">[{cIdx + 1}]</span>
                        <span className="truncate max-w-[120px]">{c.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Input Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50">
        <div className="flex items-end gap-2 bg-white dark:bg-zinc-800 p-2.5 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 focus-within:ring-2 focus-within:ring-mac-accent/40 focus-within:border-mac-accent transition-all shadow-xs">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiInputPlaceholder')}
            className="w-full resize-none bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 min-h-[38px] max-h-48 py-1.5 px-1 leading-relaxed custom-scrollbar"
          />

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="p-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white shrink-0 shadow-xs cursor-pointer"
              title={t('aiStop')}
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-1.5 rounded-xl bg-mac-accent hover:opacity-90 active:scale-95 text-white shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
              title={t('send')}
            >
              <Send size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[9px] text-gray-400 mt-1.5 px-1">
          <span>{t('aiInputHint')}</span>
          <span>{settings.provider}</span>
        </div>
      </div>
    </aside>
  );
};
