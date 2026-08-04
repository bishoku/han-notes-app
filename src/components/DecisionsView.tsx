import React, { useEffect, useState, useMemo } from 'react';
import { useDecisionStore } from '@/store/decisionStore';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { DecisionEditModal } from '@/components/DecisionEditModal';
import type { DecisionEditData } from '@/components/DecisionEditModal';
import { DateRangePicker } from '@/components/DateRangePicker';
import { 
  FileCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  Calendar, 
  User, 
  Tag, 
  FileText, 
  SlidersHorizontal,
  Filter,
  ShieldCheck,
  TrendingUp,
  LayoutGrid,
  GitCommit
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const DecisionsView: React.FC = () => {
  const { decisions, registry, loadDecisions, updateDecisionMetadata } = useDecisionStore();
  const { selectNote } = useNoteStore();
  const { setViewMode } = useUiStore();

  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'approved' | 'draft' | 'deferred'>('all');
  const [activeParticipantFilter, setActiveParticipantFilter] = useState<string>('all');
  const [dateFilterStart, setDateFilterStart] = useState<string>('');
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('');
  const [viewStyle, setViewStyle] = useState<'timeline' | 'grid'>('timeline');

  const [editingDecision, setEditingDecision] = useState<DecisionEditData | null>(null);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  // Extract unique participants
  const participantsSet = new Set<string>();
  (registry.participants || []).forEach(p => p.split(',').forEach(part => {
    const clean = part.trim();
    if (clean) participantsSet.add(clean);
  }));
  decisions.forEach(d => {
    d.participants.forEach(p => p.split(',').forEach(part => {
      const clean = part.trim();
      if (clean) participantsSet.add(clean);
    }));
  });
  const availableParticipants = Array.from(participantsSet).sort();

  // Filtered decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter(d => {
      // 1. Status Filter
      if (activeStatusFilter !== 'all') {
        const dStatus = d.status || 'approved';
        if (dStatus !== activeStatusFilter) return false;
      }

      // 2. Participant Filter
      if (activeParticipantFilter !== 'all') {
        const allPeople = [...d.participants, ...d.approved_by];
        if (!allPeople.includes(activeParticipantFilter)) return false;
      }

      // 3. Date Range Filter
      if (dateFilterStart && d.date && d.date < dateFilterStart) return false;
      if (dateFilterEnd && d.date && d.date > dateFilterEnd) return false;

      return true;
    });
  }, [decisions, activeStatusFilter, activeParticipantFilter, dateFilterStart, dateFilterEnd]);

  // Analytics
  const totalCount = decisions.length;
  const approvedCount = decisions.filter(d => (d.status || 'approved') === 'approved').length;
  const draftCount = decisions.filter(d => d.status === 'draft').length;
  
  // Most active participant
  const personCounts: Record<string, number> = {};
  decisions.forEach(d => {
    [...d.participants, ...d.approved_by].forEach(p => {
      personCounts[p] = (personCounts[p] || 0) + 1;
    });
  });
  let topPerson = 'Henüz Yok';
  let maxCount = 0;
  Object.entries(personCounts).forEach(([person, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topPerson = person;
    }
  });

  const handleNoteClick = (noteId: string) => {
    selectNote(noteId);
    setViewMode('notes');
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

  const getStatusBadge = (status?: string | null) => {
    const st = status || 'approved';
    switch (st) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={11} /> Onaylandı
          </span>
        );
      case 'draft':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={11} /> Taslak / Bekliyor
          </span>
        );
      case 'deferred':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
            <AlertCircle size={11} /> Ertelendi
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <main className="h-screen flex flex-col bg-mac-mainLight dark:bg-mac-mainDark transition-all duration-200 flex-1 p-8 overflow-y-auto select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
          <FileCheck size={32} className="text-purple-600 dark:text-purple-400" />
          Karar Kayıtları (Decision Records)
        </h1>

        {/* View Mode Toggle (Timeline vs Grid) */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setViewStyle('timeline')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewStyle === 'timeline' ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <GitCommit size={14} /> Zaman Çizelgesi
          </button>
          <button
            onClick={() => setViewStyle('grid')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewStyle === 'grid' ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <LayoutGrid size={14} /> Liste Görünümü
          </button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 max-w-5xl">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500">Toplam Karar</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalCount}</span>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl">
            <FileCheck size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500">Onaylanan Kararlar</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500">Taslak / Bekleyen</span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{draftCount}</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500">En Aktif Katılımcı</span>
            <span className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1 truncate max-w-[120px]" title={topPerson}>
              {topPerson}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Filter Section Container */}
      <div className="flex flex-col gap-3 mb-6 max-w-5xl bg-gray-50 dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-gray-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-1">
              <Filter size={13} />
              <span>Statü:</span>
            </div>
            <button
              onClick={() => setActiveStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                activeStatusFilter === 'all' ? "bg-purple-600 text-white shadow-sm" : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
              )}
            >
              Hepsi ({decisions.length})
            </button>
            <button
              onClick={() => setActiveStatusFilter('approved')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeStatusFilter === 'approved' ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
              )}
            >
              Onaylananlar ({decisions.filter(d => (d.status || 'approved') === 'approved').length})
            </button>
            <button
              onClick={() => setActiveStatusFilter('draft')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeStatusFilter === 'draft' ? "bg-amber-600 text-white shadow-sm" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
              )}
            >
              Taslaklar ({decisions.filter(d => d.status === 'draft').length})
            </button>
          </div>

          {/* Date Range Picker Filter */}
          <div className="w-64">
            <DateRangePicker
              startDate={dateFilterStart}
              endDate={dateFilterEnd}
              onChange={(s, e) => {
                setDateFilterStart(s);
                setDateFilterEnd(e);
              }}
            />
          </div>
        </div>

        {/* Participant Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-1">
            <Users size={13} />
            <span>Kişiler:</span>
          </div>
          <button
            onClick={() => setActiveParticipantFilter('all')}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-semibold transition-all",
              activeParticipantFilter === 'all' ? "bg-purple-600 text-white shadow-sm" : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
            )}
          >
            Tüm Kişiler
          </button>
          {availableParticipants.map(person => (
            <button
              key={person}
              onClick={() => setActiveParticipantFilter(person)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1",
                activeParticipantFilter === person 
                  ? "bg-purple-600 text-white shadow-sm" 
                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
              )}
            >
              <User size={11} /> {person}
            </button>
          ))}
        </div>
      </div>

      {/* Decisions List Content */}
      <div className="max-w-5xl pb-16">
        {filteredDecisions.length === 0 ? (
          <div className="text-gray-400 italic py-16 text-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
            <FileCheck size={32} className="text-gray-300 dark:text-gray-600" />
            <span>Seçilen filtrelere uygun karar kaydı bulunamadı.</span>
          </div>
        ) : viewStyle === 'timeline' ? (
          /* Timeline View */
          <div className="relative pl-6 border-l-2 border-purple-500/30 flex flex-col gap-6">
            {filteredDecisions.map((decision, idx) => (
              <div key={`${decision.note_id}-${decision.line_number}-${idx}`} className="relative group">
                {/* Timeline Circle Node */}
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-purple-600 border-4 border-white dark:border-zinc-950 shadow-sm" />

                {/* Card Container */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                          {decision.content}
                        </span>
                        {getStatusBadge(decision.status)}
                      </div>
                      {decision.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-1">
                          {decision.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingDecision({
                          noteId: decision.note_id,
                          lineNumber: decision.line_number,
                          content: decision.content,
                          description: decision.description,
                          date: decision.date,
                          status: decision.status,
                          participants: decision.participants,
                          approvedBy: decision.approved_by,
                          tags: decision.tags,
                        })}
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-purple-600 transition-colors"
                        title="Kararı Düzenle"
                      >
                        <SlidersHorizontal size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Attributes Footer */}
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-gray-50 dark:border-zinc-800/60">
                    <button 
                      onClick={() => handleNoteClick(decision.note_id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg font-medium text-gray-600 dark:text-gray-400 transition-colors"
                    >
                      <FileText size={12} />
                      {decision.note_id}
                    </button>

                    {decision.date && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg font-mono text-[11px] text-gray-600 dark:text-gray-400">
                        <Calendar size={11} /> {decision.date}
                      </span>
                    )}

                    {decision.participants.length > 0 && (
                      <div className="flex items-center gap-1">
                        {decision.participants.map(p => (
                          <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-md font-medium text-[11px]">
                            <User size={10} /> {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {decision.approved_by.length > 0 && (
                      <div className="flex items-center gap-1">
                        {decision.approved_by.map(a => (
                          <span key={a} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md font-bold text-[11px]">
                            <ShieldCheck size={10} /> Onay: {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {decision.tags && decision.tags.length > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        {decision.tags.map(t => (
                          <span key={t} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 rounded-md text-[10px] font-mono">
                            <Tag size={10} /> #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid / Compact Card View */
          <div className="grid grid-cols-2 gap-4">
            {filteredDecisions.map((decision, idx) => (
              <div 
                key={`${decision.note_id}-${decision.line_number}-${idx}`}
                className="flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all gap-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-gray-900 dark:text-gray-100 leading-snug">
                      {decision.content}
                    </span>
                    {getStatusBadge(decision.status)}
                  </div>
                  {decision.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {decision.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-50 dark:border-zinc-800/60 text-xs">
                  <button 
                    onClick={() => handleNoteClick(decision.note_id)}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-purple-600 transition-colors"
                  >
                    <FileText size={12} /> {decision.note_id}
                  </button>

                  <button
                    onClick={() => setEditingDecision({
                      noteId: decision.note_id,
                      lineNumber: decision.line_number,
                      content: decision.content,
                      description: decision.description,
                      date: decision.date,
                      status: decision.status,
                      participants: decision.participants,
                      approvedBy: decision.approved_by,
                      tags: decision.tags,
                    })}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
