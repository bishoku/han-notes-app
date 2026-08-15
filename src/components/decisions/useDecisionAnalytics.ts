import { useMemo, useState } from 'react';
import type { DecisionInfo, DecisionRegistry } from '@/services/storage';

export type DecisionStatusFilter = 'all' | 'approved' | 'draft' | 'deferred';

export function useDecisionAnalytics(decisions: DecisionInfo[], registry: DecisionRegistry) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<DecisionStatusFilter>('all');
  const [activeParticipantFilter, setActiveParticipantFilter] = useState<string>('all');
  const [dateFilterStart, setDateFilterStart] = useState<string>('');
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('');
  const [viewStyle, setViewStyle] = useState<'timeline' | 'grid'>('timeline');

  // Extract unique participants with useMemo
  const availableParticipants = useMemo(() => {
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
    return Array.from(participantsSet).sort();
  }, [decisions, registry.participants]);

  // Filtered decisions with useMemo
  const filteredDecisions = useMemo(() => {
    return decisions.filter(d => {
      if (activeStatusFilter !== 'all') {
        const dStatus = d.status || 'approved';
        if (dStatus !== activeStatusFilter) return false;
      }

      if (activeParticipantFilter !== 'all') {
        const allPeople = [...d.participants, ...d.approved_by];
        if (!allPeople.includes(activeParticipantFilter)) return false;
      }

      if (dateFilterStart && d.date && d.date < dateFilterStart) return false;
      if (dateFilterEnd && d.date && d.date > dateFilterEnd) return false;

      return true;
    });
  }, [decisions, activeStatusFilter, activeParticipantFilter, dateFilterStart, dateFilterEnd]);

  // Analytics metrics with useMemo
  const analytics = useMemo(() => {
    const totalCount = decisions.length;
    const approvedCount = decisions.filter(d => (d.status || 'approved') === 'approved').length;
    const draftCount = decisions.filter(d => d.status === 'draft').length;

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

    return {
      totalCount,
      approvedCount,
      draftCount,
      topPerson,
    };
  }, [decisions]);

  return {
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
  };
}
