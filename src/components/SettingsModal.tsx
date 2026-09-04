import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import { useNoteStore } from '@/store/noteStore';
import type { AppTheme } from '@/utils/theme';
import { IntegrationsSettingsTab } from '@/components/settings/IntegrationsSettingsTab';
import { GitSyncSettingsTab } from '@/components/settings/GitSyncSettingsTab';
import { WebClipperSettingsTab } from '@/components/settings/WebClipperSettingsTab';
import { SyncSettingsTab } from '@/components/settings/SyncSettingsTab';
import { X, Globe, Palette, Check, Folder, FolderOpen, Loader2, Sliders, Bot, GitBranch, ArrowDownUp, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeOption {
  id: AppTheme;
  name: string;
  bgClass: string;
  accentColor: string;
  previewDots: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light',
    bgClass: 'bg-white text-gray-900 border-gray-200',
    accentColor: '#007aff',
    previewDots: ['#ffffff', '#f9f9f9', '#007aff'],
  },
  {
    id: 'dark',
    name: 'Dark',
    bgClass: 'bg-zinc-900 text-gray-100 border-zinc-700',
    accentColor: '#007aff',
    previewDots: ['#161616', '#1e1e1e', '#007aff'],
  },
  {
    id: 'nord',
    name: 'Nord',
    bgClass: 'bg-[#2e3440] text-[#eceff4] border-[#4c566a]',
    accentColor: '#88c0d0',
    previewDots: ['#2e3440', '#3b4252', '#88c0d0'],
  },
  {
    id: 'dracula',
    name: 'Dracula',
    bgClass: 'bg-[#21222c] text-[#f8f8f2] border-[#44475a]',
    accentColor: '#bd93f9',
    previewDots: ['#21222c', '#282a36', '#bd93f9'],
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    bgClass: 'bg-[#181528] text-[#e2e8f0] border-[#3b2d54]',
    accentColor: '#ff79c6',
    previewDots: ['#181528', '#241e3a', '#ff79c6'],
  },
  {
    id: 'retro',
    name: 'Retro',
    bgClass: 'bg-[#1a1412] text-[#f5e6d3] border-[#42352f]',
    accentColor: '#d97706',
    previewDots: ['#1a1412', '#261e1b', '#d97706'],
  },
];

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const { isSettingsModalOpen, setSettingsModalOpen, theme, setTheme, language, setLanguage } = useUiStore();
  const { vaultPath, switchVault, notes, clearAllNotes } = useNoteStore();
  const [isSwitching, setIsSwitching] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'git' | 'clipper' | 'sync'>('general');
  const [clearStep, setClearStep] = useState<'none' | 'step1' | 'step2'>('none');
  const [verifyInput, setVerifyInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const verificationWord = t('clearAllNotesVerificationWord') || 'DELETE';

  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      await clearAllNotes();
      setClearStep('none');
      setVerifyInput('');
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to clear all notes:', err);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsModalOpen) {
        if (clearStep !== 'none') {
          setClearStep('none');
        } else {
          setSettingsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, setSettingsModalOpen, clearStep]);

  const handleSwitchVault = async () => {
    setIsSwitching(true);
    try {
      await switchVault();
    } finally {
      setIsSwitching(false);
    }
  };

  if (!isSettingsModalOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 pt-safe pb-safe">
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-2xl max-h-[92dvh] sm:max-h-[85vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50 gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-gray-200/60 dark:bg-zinc-800 rounded-xl overflow-x-auto no-scrollbar touch-pan-x max-w-[calc(100%-36px)]">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                activeTab === 'general'
                  ? "bg-white dark:bg-zinc-700 text-mac-accent shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <Sliders size={13} />
              <span>{t('settings')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integrations')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                activeTab === 'integrations'
                  ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <Bot size={13} />
              <span>{t('aiSettingsTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('git')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                activeTab === 'git'
                  ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <GitBranch size={13} />
              <span>{t('gitSyncTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clipper')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                activeTab === 'clipper'
                  ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <Globe size={13} />
              <span>{t('webClipperTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                activeTab === 'sync'
                  ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <ArrowDownUp size={13} />
              <span>{t('syncSettingsTab')}</span>
            </button>
          </div>

          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto max-h-[75dvh] touch-pan-y">
          {activeTab === 'git' ? (
            <GitSyncSettingsTab />
          ) : activeTab === 'integrations' ? (
            <IntegrationsSettingsTab />
          ) : activeTab === 'clipper' ? (
            <WebClipperSettingsTab />
          ) : activeTab === 'sync' ? (
            <SyncSettingsTab />
          ) : (
            <>
              {/* Clear Success Banner */}
              {clearSuccess && (
                <div className="p-3.5 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/80 dark:bg-green-950/30 text-green-800 dark:text-green-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <Check size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                  <span>{t('clearAllNotesSuccess')}</span>
                </div>
              )}

              {/* Workspace / Vault Folder Selection */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Folder size={14} className="text-amber-500" />
                  {t('workspace')}
                </label>
                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        {t('currentVault')}
                      </div>
                      <div 
                        className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100 truncate mt-0.5" 
                        title={vaultPath || ''}
                      >
                        {vaultPath || t('noVaultSelected')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchVault}
                      disabled={isSwitching}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-600 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isSwitching ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-mac-accent" />
                          <span>{t('switching')}</span>
                        </>
                      ) : (
                        <>
                          <FolderOpen size={13} />
                          <span>{t('changeFolder')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-normal">
                    {t('vaultSwitchDescription')}
                  </p>
                </div>
              </div>

              {/* Language Selection */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Globe size={14} className="text-blue-500" />
                  {t('language')}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('tr')}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                      language === 'tr'
                        ? "border-mac-accent bg-mac-accent/10 text-mac-accent shadow-xs"
                        : "border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🇹🇷</span>
                      <span>Türkçe</span>
                    </div>
                    {language === 'tr' && <Check size={16} className="text-mac-accent" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                      language === 'en'
                        ? "border-mac-accent bg-mac-accent/10 text-mac-accent shadow-xs"
                        : "border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🇺🇸</span>
                      <span>English</span>
                    </div>
                    {language === 'en' && <Check size={16} className="text-mac-accent" />}
                  </button>
                </div>
              </div>

              {/* Theme Selection (6 Themes) */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Palette size={14} className="text-purple-500" />
                  {t('theme')}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {THEME_OPTIONS.map((item) => {
                    const isSelected = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={cn(
                          "p-3 rounded-xl border text-xs flex flex-col gap-2.5 transition-all text-left relative overflow-hidden cursor-pointer",
                          item.bgClass,
                          isSelected ? "ring-2 ring-mac-accent border-mac-accent shadow-md scale-[1.02]" : "opacity-85 hover:opacity-100 hover:scale-[1.01]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{item.name}</span>
                          {isSelected && (
                            <span className="p-0.5 rounded-full bg-mac-accent text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </div>
                        {/* Color Dots */}
                        <div className="flex items-center gap-1.5">
                          {item.previewDots.map((color, idx) => (
                            <span
                              key={idx}
                              className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shadow-2xs"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone: Clear All Notes */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-red-100 dark:border-red-950/40">
                <label className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  {t('dangerZone')}
                </label>
                <div className="p-3.5 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-red-900 dark:text-red-200">
                        {t('clearAllNotesTitle')}
                      </div>
                      <p className="text-[11px] text-red-700/80 dark:text-red-300/70 leading-normal mt-0.5">
                        {t('clearAllNotesDesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyInput('');
                        setClearStep('step1');
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                      <span>{t('clearAllNotesButton')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Double Confirmation Modal Overlay */}
        {clearStep !== 'none' && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div 
              className="w-full max-w-md bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {clearStep === 'step1' ? (
                <>
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {t('clearAllNotesConfirmStep1Title')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                        {t('clearAllNotesConfirmStep1Message', { count: notes.length })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setClearStep('none')}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClearStep('step2')}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      {t('clearAllNotesProceed')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                      <Trash2 size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
                        {t('clearAllNotesConfirmStep2Title')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                        {t('clearAllNotesConfirmStep2Message', { word: verificationWord })}
                      </p>
                      <div className="mt-2 inline-block">
                        <span className="select-all font-mono font-bold text-xs tracking-wider px-2 py-1 rounded-md bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                          {verificationWord}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={verifyInput}
                      onChange={(e) => setVerifyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && verifyInput.trim() === verificationWord && !isClearing) {
                          handleExecuteClear();
                        }
                      }}
                      placeholder={t('clearAllNotesVerificationPlaceholder')}
                      className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => {
                        setClearStep('none');
                        setVerifyInput('');
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={verifyInput.trim() !== verificationWord || isClearing}
                      onClick={handleExecuteClear}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-zinc-800 disabled:text-gray-500 dark:disabled:text-zinc-600 disabled:cursor-not-allowed text-white active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {isClearing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>{t('clearAllNotesClearing')}</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={13} />
                          <span>{t('clearAllNotesFinalButton')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex justify-end">
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-mac-accent text-white hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
          >
            {t('ok')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
