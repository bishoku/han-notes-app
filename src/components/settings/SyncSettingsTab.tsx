import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '@/store/syncStore';
import { DEFAULT_SIGNALING_URL } from '@/services/sync/signalingClient';
import { isFileSystemAccessSupported, isTauriEnvironment } from '@/services/storage';
import {
  ArrowDownUp,
  ShieldCheck,
  Server,
  QrCode,
  HardDrive,
  Check,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { syncStorageAdapter } from '@/services/sync/syncStorageAdapter';

export const SyncSettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const {
    openModal,
    customSignalingUrl,
    setCustomSignalingUrl,
    lastReport,
  } = useSyncStore();

  const [urlInput, setUrlInput] = useState(customSignalingUrl);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSignalingUrl(urlInput.trim() || DEFAULT_SIGNALING_URL);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetUrl = () => {
    setUrlInput(DEFAULT_SIGNALING_URL);
    setCustomSignalingUrl(DEFAULT_SIGNALING_URL);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearMetadata = async () => {
    if (window.confirm(t('syncClearMetadataConfirm'))) {
      const meta = await syncStorageAdapter.loadMetadata();
      meta.tombstones = {};
      await syncStorageAdapter.saveMetadata();
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    }
  };

  const storageBackendName = isTauriEnvironment()
    ? 'Tauri Native Rust'
    : isFileSystemAccessSupported()
    ? 'File System Access API (Local Disk .md)'
    : 'IndexedDB (Mobile / Web Fallback)';

  return (
    <div className="space-y-6 select-text text-xs leading-relaxed text-gray-700 dark:text-gray-300">
      {/* Overview Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ArrowDownUp size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('syncSettingsTitle')}</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('syncSettingsSubtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
            <span>{t('syncFeatureE2ee')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <QrCode size={13} className="text-indigo-500 shrink-0" />
            <span>{t('syncFeatureQrPairing')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <HardDrive size={13} className="text-purple-500 shrink-0" />
            <span>{storageBackendName}</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => openModal('share')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <QrCode size={14} />
            <span>{t('syncStartPairingButton')}</span>
          </button>
        </div>
      </div>

      {/* Signaling Server Configuration */}
      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-indigo-500" />
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">{t('syncSignalingServerTitle')}</h4>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('syncSignalingServerDesc')}
        </p>

        <form onSubmit={handleSaveUrl} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="wss://..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              {saved ? <Check size={14} /> : null}
              <span>{saved ? t('saved') : t('save')}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{t('syncDefaultServerLabel')}: {DEFAULT_SIGNALING_URL}</span>
            <button
              type="button"
              onClick={handleResetUrl}
              className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {t('reset')}
            </button>
          </div>
        </form>
      </div>

      {/* Last Sync Session Information */}
      {lastReport && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">{t('syncLastReportTitle')}</h4>
            </div>
            <span className="text-[11px] text-gray-400">
              {new Date(lastReport.syncedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
              <div className="font-bold text-indigo-600 dark:text-indigo-400">{lastReport.sentNotesCount}</div>
              <div className="text-[10px] text-gray-400">{t('syncSentNotes')}</div>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
              <div className="font-bold text-purple-600 dark:text-purple-400">{lastReport.receivedNotesCount}</div>
              <div className="text-[10px] text-gray-400">{t('syncReceivedNotes')}</div>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
              <div className="font-bold text-amber-500">{lastReport.deletedNotesCount}</div>
              <div className="text-[10px] text-gray-400">{t('syncDeletedTombstones')}</div>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
              <div className="font-bold text-emerald-500">{lastReport.conflictsCount}</div>
              <div className="text-[10px] text-gray-400">{t('syncConflictsCount')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance / Tombstone Management */}
      <div className="pt-2 flex items-center justify-between border-t border-gray-100 dark:border-zinc-800">
        <div>
          <h5 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t('syncClearTombstonesTitle')}</h5>
          <p className="text-[11px] text-gray-400">{t('syncClearTombstonesDesc')}</p>
        </div>
        <button
          type="button"
          onClick={handleClearMetadata}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
        >
          {cleared ? <Check size={13} /> : <Trash2 size={13} />}
          <span>{cleared ? t('done') : t('clear')}</span>
        </button>
      </div>
    </div>
  );
};
