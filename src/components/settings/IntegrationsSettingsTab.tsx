/**
 * IntegrationsSettingsTab.tsx — Settings panel for configuring LLM Providers,
 * API Keys, and managing Local-First Vector Indexing with multi-language i18n support.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiStore } from '@/store/aiStore';
import { llmClient } from '@/services/ai/llmClient';
import {
  PROVIDER_PRESETS,
  type AiProvider,
} from '@/services/ai/types';
import {
  Bot,
  Key,
  Globe,
  Cpu,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Database,
  RotateCcw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const IntegrationsSettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const {
    settings,
    updateSettings,
    toggleAiEnabled,
    vectorStats,
    isIndexing,
    indexingProgress,
    reindexVault,
    purgeVectors,
  } = useAiStore();

  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string } | null>(null);

  const currentPreset = PROVIDER_PRESETS[settings.provider] || PROVIDER_PRESETS.openrouter;

  const handleProviderChange = (provider: AiProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    updateSettings({
      provider,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
    });
    setTestStatus(null);
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    const res = await llmClient.testConnection(settings);
    setTestStatus({ loading: false, success: res.success, message: res.message });
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-gray-800 dark:text-gray-200">
      {/* 1. Master Toggle */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-mac-accent/10 via-purple-500/10 to-pink-500/10 border border-mac-accent/20 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-mac-accent text-white shadow-sm mt-0.5">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <span>{t('aiMasterToggle')}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold">
                Local-First
              </span>
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              {t('aiMasterToggleDesc')}
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => toggleAiEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-mac-accent"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* 2. Provider Selection */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Cpu size={14} className="text-mac-accent" />
              {t('aiProvider')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_PRESETS) as AiProvider[]).map((key) => {
                const preset = PROVIDER_PRESETS[key];
                const isSelected = settings.provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleProviderChange(key)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                      isSelected
                        ? "border-mac-accent bg-mac-accent/5 dark:bg-mac-accent/10 shadow-xs ring-2 ring-mac-accent/20"
                        : "border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <span className={cn("font-bold text-xs", isSelected ? "text-mac-accent" : "text-gray-800 dark:text-gray-200")}>
                      {preset.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
                      {preset.name.replace(/^[^\s]+\s*/, '') || 'Default'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. API Key (if required) */}
          {currentPreset.requiresApiKey && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Key size={14} className="text-purple-500" />
                  {t('aiApiKey')}
                </label>
                {currentPreset.docUrl && (
                  <a
                    href={currentPreset.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-mac-accent hover:underline flex items-center gap-1"
                  >
                    <span>{t('aiGetKey')}</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                🔒 {t('aiApiKeyHint')}
              </p>
            </div>
          )}

          {/* 4. Model Selection & Base URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Model Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                {t('aiModelName')}
              </label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => updateSettings({ model: e.target.value })}
                placeholder={currentPreset.defaultModel}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
              />

              {/* Recommended Model Badges */}
              {currentPreset.recommendedModels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentPreset.recommendedModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateSettings({ model: m.id })}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer border",
                        settings.model === m.id
                          ? "bg-mac-accent text-white border-mac-accent font-bold"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200"
                      )}
                      title={m.description}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Globe size={14} className="text-blue-500" />
                {t('aiApiUrl')}
              </label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => updateSettings({ baseUrl: e.target.value })}
                placeholder={currentPreset.defaultBaseUrl}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
              />
              <button
                type="button"
                onClick={() => updateSettings({ baseUrl: currentPreset.defaultBaseUrl })}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-left cursor-pointer"
              >
                {t('aiResetDefault')}
              </button>
            </div>
          </div>

          {/* 5. Test Connection Button & Status */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus?.loading}
              className="px-4 py-2 rounded-xl bg-mac-accent hover:opacity-90 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {testStatus?.loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{t('aiTesting')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>{t('aiTestConnection')}</span>
                </>
              )}
            </button>

            {testStatus && !testStatus.loading && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium",
                  testStatus.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                    : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40"
                )}
              >
                {testStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span className="truncate max-w-xs">{testStatus.message || (testStatus.success ? t('aiTestSuccess') : t('aiTestFailed'))}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />

          {/* 6. Vector Database & Indexing Status */}
          <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-mac-accent" />
                <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                  {t('aiVectorStats')}
                </span>
              </div>

              {isIndexing ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-mac-accent animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  <span>{t('aiIndexing')}: {indexingProgress.current}/{indexingProgress.total}</span>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {t('aiIndexedStats', { chunks: vectorStats.totalChunks, notes: vectorStats.totalNotes })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reindexVault}
                disabled={isIndexing}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 font-medium text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              >
                <RotateCcw size={12} />
                <span>{t('aiReindex')}</span>
              </button>

              <button
                type="button"
                onClick={purgeVectors}
                disabled={isIndexing}
                className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-medium text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Trash2 size={12} />
                <span>{t('aiPurgeIndex')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
