/**
 * NoteHistoryDrawer.tsx — Slide-over panel for Note Version History & Visual Line Diff.
 * Enables users to browse past commits, inspect additions/deletions, and 1-click restore.
 */
import React, { useState } from 'react';
import { useGitStore } from '@/store/gitStore';
import { useNoteStore } from '@/store/noteStore';
import {
  X,
  History,
  RotateCcw,
  GitCommit,
  Clock,
  User,
  Check,
  Plus,
  Minus,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const NoteHistoryDrawer: React.FC = () => {
  const {
    isHistoryDrawerOpen,
    historyNoteId,
    historyCommits,
    selectedCommit,
    diffResult,
    isLoadingHistory,
    isLoadingDiff,
    hasMoreHistory,
    isLoadingMoreHistory,
    closeHistoryDrawer,
    selectHistoryCommit,
    loadMoreHistory,
    revertNote,
  } = useGitStore();

  const { notes } = useNoteStore();
  const [isReverting, setIsReverting] = useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);

  if (!isHistoryDrawerOpen || !historyNoteId) return null;

  const currentNote = notes.find((n) => n.id === historyNoteId);
  const noteTitle = currentNote?.title || historyNoteId.split('/').pop() || historyNoteId;

  const handleConfirmRevert = async () => {
    if (!selectedCommit) return;
    setIsReverting(true);
    const success = await revertNote(historyNoteId, selectedCommit.hash);
    setIsReverting(false);
    setConfirmRevertOpen(false);
    if (success) {
      closeHistoryDrawer();
    }
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 60) {
      loadMoreHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl h-full bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                <span>Versiyon Geçmişi:</span>
                <span className="text-purple-600 dark:text-purple-400 font-medium truncate">
                  {noteTitle}
                </span>
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {historyCommits.length} sürüm gösteriliyor
                {hasMoreHistory && ' (aşağı kaydırın...)'}
              </p>
            </div>
          </div>

          <button
            onClick={closeHistoryDrawer}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: 2 Columns (Timeline List + Diff View) */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-gray-200 dark:divide-zinc-800">
          {/* Left Column: Commits Timeline */}
          <div
            onScroll={handleTimelineScroll}
            className="w-80 flex flex-col bg-gray-50/30 dark:bg-zinc-950/20 overflow-y-auto"
          >
            <div className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800/60 sticky top-0 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur-xs z-10">
              Sürüm Zaman Çizelgesi
            </div>

            {isLoadingHistory ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                <span className="text-xs">Sürümler yükleniyor...</span>
              </div>
            ) : historyCommits.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <AlertCircle className="w-8 h-8 stroke-1 mb-2 opacity-60" />
                <span className="text-xs font-medium">Kayıtlı sürüm bulunamadı</span>
                <span className="text-[11px] text-gray-500 mt-1">
                  Notta düzenleme yapıldığında otomatik versiyonlanacaktır.
                </span>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {historyCommits.map((commit, idx) => {
                  const isSelected = selectedCommit?.hash === commit.hash;
                  return (
                    <button
                      key={commit.hash}
                      onClick={() => selectHistoryCommit(commit)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 border cursor-pointer',
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/60 shadow-2xs'
                          : 'bg-white dark:bg-zinc-900/60 border-gray-200/70 dark:border-zinc-800/60 hover:bg-gray-100/70 dark:hover:bg-zinc-800/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GitCommit className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400')} />
                          <span className={cn('text-xs font-medium truncate', isSelected ? 'text-purple-900 dark:text-purple-200' : 'text-gray-800 dark:text-gray-200')}>
                            {commit.message || 'Not güncellemesi'}
                          </span>
                        </div>
                        {idx === 0 && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                            Güncel
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-zinc-800/40">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(commit.timestamp).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="font-mono text-[9px] px-1 rounded bg-black/5 dark:bg-white/5">
                          {commit.shortHash}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {isLoadingMoreHistory && (
                  <div className="flex items-center justify-center p-3 text-[11px] text-gray-400 gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                    <span>Daha eski sürümler yükleniyor...</span>
                  </div>
                )}

                {!hasMoreHistory && historyCommits.length >= 15 && (
                  <div className="text-center py-2.5 text-[10px] text-gray-400 dark:text-gray-500">
                    Tüm geçmiş yüklendi ({historyCommits.length} sürüm)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Visual Diff & Restore Action */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 overflow-hidden">
            {selectedCommit ? (
              <>
                {/* Diff Toolbar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/40 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">{selectedCommit.author}</span>
                    </div>

                    {diffResult && (
                      <div className="flex items-center gap-2 text-[11px] font-mono pl-3 border-l border-gray-200 dark:border-zinc-700">
                        <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Plus className="w-3 h-3 mr-0.5" />
                          {diffResult.additions}
                        </span>
                        <span className="flex items-center text-red-600 dark:text-red-400 font-semibold">
                          <Minus className="w-3 h-3 mr-0.5" />
                          {diffResult.deletions}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmRevertOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Bu Sürüme Geri Dön</span>
                    </button>
                  </div>
                </div>

                {/* Diff Viewer Area */}
                <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text bg-gray-50/20 dark:bg-zinc-950/40">
                  {isLoadingDiff ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500 mr-2" />
                      <span>Farklar hesaplanıyor...</span>
                    </div>
                  ) : !diffResult || diffResult.lines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <Check className="w-8 h-8 text-emerald-500 mb-2" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Bu sürüm ile mevcut not arasında hiçbir fark yok.
                      </span>
                    </div>
                  ) : (
                    <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                      <table className="w-full border-collapse">
                        <tbody>
                          {diffResult.lines.map((line, lineIdx) => {
                            const isAdd = line.type === 'add';
                            const isDel = line.type === 'delete';

                            return (
                              <tr
                                key={lineIdx}
                                className={cn(
                                  'hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
                                  isAdd && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                                  isDel && 'bg-red-500/10 text-red-900 dark:text-red-200 line-through opacity-80'
                                )}
                              >
                                {/* Old Line No */}
                                <td className="w-12 px-2 py-0.5 text-right text-[10px] text-gray-400 select-none border-r border-gray-100 dark:border-zinc-800/60 font-mono">
                                  {line.oldLineNumber || ''}
                                </td>

                                {/* New Line No */}
                                <td className="w-12 px-2 py-0.5 text-right text-[10px] text-gray-400 select-none border-r border-gray-100 dark:border-zinc-800/60 font-mono">
                                  {line.newLineNumber || ''}
                                </td>

                                {/* Sign indicator */}
                                <td className="w-6 px-1 py-0.5 text-center text-xs font-bold select-none font-mono">
                                  {isAdd ? '+' : isDel ? '-' : ' '}
                                </td>

                                {/* Line content */}
                                <td className="px-2 py-0.5 whitespace-pre-wrap break-all text-xs">
                                  {line.content || ' '}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
                <FileText className="w-10 h-10 stroke-1 mb-2 opacity-50" />
                <span className="text-xs">İncelemek için sol taraftan bir sürüm seçin.</span>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal for Revert */}
        {confirmRevertOpen && selectedCommit && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Bu Sürüme Geri Dönsün Mü?
                </h3>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-900 dark:text-gray-100">"{noteTitle}"</strong> notunun içeriği,{' '}
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {selectedCommit.shortHash}
                </span>{' '}
                ({new Date(selectedCommit.timestamp).toLocaleString('tr-TR')}) tarihindeki haline geri döndürülecektir.
                Mevcut hali de yeni bir sürüm olarak saklanacaktır.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmRevertOpen(false)}
                  disabled={isReverting}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleConfirmRevert}
                  disabled={isReverting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-xs"
                >
                  {isReverting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Evet, Geri Yükle</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
