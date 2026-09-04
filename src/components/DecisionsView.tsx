import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDecisionStore } from '@/store/decisionStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { FileCheck, Menu, PanelLeftOpen, GitCommit, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDecisionAnalytics } from './decisions/useDecisionAnalytics';
import { DecisionsStats } from './decisions/DecisionsStats';
import { DecisionsHeader } from './decisions/DecisionsHeader';
import { DecisionsTimelineView } from './decisions/DecisionsTimelineView';
import { DecisionsGridView } from './decisions/DecisionsGridView';

export const DecisionsView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { decisions, registry, loadDecisions, updateDecisionMetadata } = useDecisionStore();
  const selectNote = useNoteStore(state => state.selectNote);
  const setViewMode = useUiStore(state => state.setViewMode);
  const sidebarOpen = useUiStore(state => state.sidebarOpen);
  const setSidebarOpen = useUiStore(state => state.setSidebarOpen);
  const [editingDecision, setEditingDecision] = useState<DecisionEditData | null>(null);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const {
    activeStatusFilter,
    setActiveStatusFilter,
    activeParticipantFilter,
    setActiveParticipantFilter,
    dateFilterStart,
    setDateFilterStart,
    dateFilterEnd,
    setDateFilterEnd,
    viewStyle,
    setViewStyle,
    availableParticipants,
    filteredDecisions,
    analytics,
  } = useDecisionAnalytics(decisions, registry);

  const handleNoteClick = (noteId: string) => {
    selectNote(noteId);
    setViewMode('notes');
    navigate(`/notes/${encodeURIComponent(noteId)}`);
  };

  const handleSaveModal = async (updated: DecisionEditData) => {
    await updateDecisionMetadata(
      updated.noteId,
      updated.lineNumber,
      updated.content,
      {
        description: updated.description,
        date: updated.date,
        status: updated.status,
        participants: updated.participants,
        approvedBy: updated.approvedBy,
        tags: updated.tags,
      }
    );
  };

  return (
    <main className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 flex-1 overflow-hidden select-none min-h-0">
      {/* Top Header Bar (Aligned with EditorHeader, TasksView, MindmapView) */}
      <header className="shrink-0 pt-safe bg-mac-mainLight/80 dark:bg-mac-mainDark/80 backdrop-blur-xs border-b border-mac-borderLight dark:border-mac-borderDark z-30 select-none">
        <div className="h-11 min-h-[44px] flex items-center justify-between px-3 md:px-4 gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-1">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 -ml-1 min-w-[38px] min-h-[38px] flex items-center justify-center active:scale-95"
              title={t('expandSidebar')}
            >
              <Menu size={20} />
            </button>

            {/* Desktop Expand Sidebar Button (when collapsed) */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="hidden md:inline-flex p-1 rounded-md text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer shrink-0 mr-0.5"
                title={t('expandSidebar')}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}

            {/* View Title with Icon */}
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <FileCheck size={16} className="shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="truncate text-gray-700 dark:text-gray-300 font-semibold text-xs md:text-sm">
                {t('decisionRecords')}
              </span>
              <span className="text-[11px] text-gray-400 font-normal">
                ({analytics.totalCount})
              </span>
            </div>
          </div>

          {/* View Mode Toggle (Timeline vs Grid) */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setViewStyle('timeline')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewStyle === 'timeline'
                  ? "bg-white dark:bg-zinc-700 shadow-xs text-gray-900 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <GitCommit size={13} />
              <span className="hidden sm:inline">{t('decisionTimelineView')}</span>
            </button>
            <button
              onClick={() => setViewStyle('grid')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                viewStyle === 'grid'
                  ? "bg-white dark:bg-zinc-700 shadow-xs text-gray-900 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">{t('decisionGridView')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 select-none min-h-0 pb-safe">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 pb-16 w-full">
          {/* Filter Section Container */}
          <DecisionsHeader
            viewStyle={viewStyle}
            setViewStyle={setViewStyle}
            totalCount={analytics.totalCount}
            approvedCount={analytics.approvedCount}
            draftCount={analytics.draftCount}
            activeStatusFilter={activeStatusFilter}
            setActiveStatusFilter={setActiveStatusFilter}
            dateFilterStart={dateFilterStart}
            setDateFilterStart={setDateFilterStart}
            dateFilterEnd={dateFilterEnd}
            setDateFilterEnd={setDateFilterEnd}
            availableParticipants={availableParticipants}
            activeParticipantFilter={activeParticipantFilter}
            setActiveParticipantFilter={setActiveParticipantFilter}
          />

          {/* Analytics Summary Cards */}
          <DecisionsStats
            totalCount={analytics.totalCount}
            approvedCount={analytics.approvedCount}
            draftCount={analytics.draftCount}
            topPerson={analytics.topPerson}
          />

          {/* Decisions List Content */}
          <div>
            {filteredDecisions.length === 0 ? (
              <div className="text-gray-400 italic py-16 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
                <FileCheck size={32} className="text-gray-300 dark:text-gray-600" />
                <span>{t('noDecisionsMatchFilter')}</span>
              </div>
            ) : viewStyle === 'timeline' ? (
              <DecisionsTimelineView
                filteredDecisions={filteredDecisions}
                onSelectNote={handleNoteClick}
                onEditDecision={setEditingDecision}
              />
            ) : (
              <DecisionsGridView
                filteredDecisions={filteredDecisions}
                onSelectNote={handleNoteClick}
                onEditDecision={setEditingDecision}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingDecision && (
        <DecisionEditModal
          decision={editingDecision}
          onSave={handleSaveModal}
          onClose={() => setEditingDecision(null)}
        />
      )}
    </main>
  );
};
