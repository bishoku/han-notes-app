import React, { useState, useEffect } from 'react';
import { Calendar, User, Tag, AlignLeft, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EditModal } from '@/components/EditModal';
import { MultiBadgeSelect } from '@/components/MultiBadgeSelect';
import { SingleDatePicker } from '@/components/SingleDatePicker';
import { useDecisionStore } from '@/store/decisionStore';

export interface DecisionEditData {
  noteId: string;
  lineNumber: number;
  content: string;
  description?: string | null;
  date?: string | null;
  status?: string | null;
  participants: string[];
  approvedBy: string[];
  tags: string[];
}

interface DecisionEditModalProps {
  decision: DecisionEditData;
  onSave: (updated: DecisionEditData) => Promise<void>;
  onClose: () => void;
}

export const DecisionEditModal: React.FC<DecisionEditModalProps> = ({ decision, onSave, onClose }) => {
  const { registry, loadDecisionRegistry } = useDecisionStore();
  const { t } = useTranslation();

  const [content, setContent] = useState(decision.content);
  const [description, setDescription] = useState(decision.description || '');
  const [date, setDate] = useState(decision.date || '');
  const [status, setStatus] = useState<string>(decision.status || 'approved');
  const [participants, setParticipants] = useState<string[]>(decision.participants || []);
  const [approvedBy, setApprovedBy] = useState<string[]>(decision.approvedBy || []);
  const [tags, setTags] = useState<string[]>(decision.tags || []);

  useEffect(() => {
    loadDecisionRegistry();
  }, [loadDecisionRegistry]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onSave({
      noteId: decision.noteId,
      lineNumber: decision.lineNumber,
      content: content.trim(),
      description: description.trim() || null,
      date: date || null,
      status: status || 'approved',
      participants,
      approvedBy,
      tags,
    });
  };

  return (
    <EditModal
      icon={<ShieldCheck size={18} className="text-purple-600 dark:text-purple-400" />}
      title={t('editDecision')}
      accentClass="bg-purple-600 hover:bg-purple-700"
      overflowClass="overflow-visible"
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      {/* Decision Title */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-gray-600 dark:text-gray-400">{t('decisionTitle')}</label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('decisionTitlePlaceholder')}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium text-gray-800 dark:text-gray-200"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <AlignLeft size={12} /> {t('decisionRationale')}
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('decisionRationalePlaceholder')}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-gray-800 dark:text-gray-200 resize-y"
        />
      </div>

      {/* Status & Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-gray-600 dark:text-gray-400">{t('decisionStatus')}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-gray-800 dark:text-gray-200 font-medium"
          >
            <option value="approved">{t('statusApproved')}</option>
            <option value="draft">{t('statusDraft')}</option>
            <option value="deferred">{t('statusDeferred')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 relative">
          <label className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Calendar size={12} /> {t('decisionDate')}
          </label>
          <SingleDatePicker
            value={date}
            onChange={setDate}
            placeholder={t('datePlaceholder')}
          />
        </div>
      </div>

      {/* Participants */}
      <MultiBadgeSelect
        label={t('participants')}
        icon={<User size={12} />}
        values={participants}
        onChange={setParticipants}
        suggestions={registry.participants}
        placeholder={t('participantPlaceholder')}
        badgeStyle="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      />

      {/* Approved By */}
      <MultiBadgeSelect
        label={t('approvedBy')}
        icon={<ShieldCheck size={12} />}
        values={approvedBy}
        onChange={setApprovedBy}
        suggestions={registry.approved_by}
        placeholder={t('approverPlaceholder')}
        badgeStyle="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      />

      {/* Tags */}
      <MultiBadgeSelect
        label={t('tagsLabel')}
        icon={<Tag size={12} />}
        values={tags}
        onChange={setTags}
        suggestions={registry.tags}
        placeholder={t('decisionTagsPlaceholder')}
        badgeStyle="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
      />
    </EditModal>
  );
};
