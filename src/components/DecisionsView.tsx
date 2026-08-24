import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDecisionStore } from '@/store/decisionStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { FileCheck } from 'lucide-react';
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
    <main className="h-full flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 flex-1 p-8 overflow-y-auto select-none min-h-0">
      {/* Header Bar & Filter Controls */}
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
      <div className="max-w-5xl pb-16">
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
