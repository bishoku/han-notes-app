import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  X,
  FileCode2,
  ScanText,
  BookOpen,
  Sparkles,
  Loader2,
  AlertTriangle,
  Folder,
  FolderPlus,
  Check,
} from 'lucide-react';
import { parsePdfDocument, type ParsedPdfResult } from '@/services/pdf/pdfParser';
import { storage } from '@/services/storage';
import { useNoteStore } from '@/store/noteStore';
import { useUiStore } from '@/store/uiStore';
import { useAiStore } from '@/store/aiStore';
import { llmClient } from '@/services/ai/llmClient';
import { performLocalOcrOnPdf } from '@/services/pdf/ocrService';
import type { FileNode } from '@/services/storage/types';

interface PdfImportModalProps {
  isOpen: boolean;
  fileData: { file: File; buffer: ArrayBuffer } | null;
  onClose: () => void;
  onNoteCreated: (noteId: string) => void;
  currentNoteId: string | null;
}

export const PdfImportModal: React.FC<PdfImportModalProps> = ({
  isOpen,
  fileData,
  onClose,
  onNoteCreated,
  currentNoteId,
}) => {
  const { t } = useTranslation();
  const fileTree = useNoteStore((s) => s.fileTree);
  const activeFolderPath = useNoteStore((s) => s.activeFolderPath);
  const createFolder = useNoteStore((s) => s.createFolder);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedPdfResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Target Folder Selection State
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Extract all existing folder paths in vault
  const folderList = useMemo(() => {
    const folders: string[] = [];
    const traverse = (list: FileNode[]) => {
      for (const node of list) {
        if (node.is_dir) {
          folders.push(node.relative_path);
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        }
      }
    };
    traverse(fileTree);
    return folders.sort();
  }, [fileTree]);

  // Initialize selected folder based on current note or active folder
  useEffect(() => {
    if (!isOpen) return;
    if (currentNoteId && currentNoteId.includes('/')) {
      setSelectedFolder(currentNoteId.split('/').slice(0, -1).join('/'));
    } else if (activeFolderPath) {
      setSelectedFolder(activeFolderPath);
    } else {
      setSelectedFolder('');
    }
  }, [isOpen, currentNoteId, activeFolderPath]);

  // Analyze PDF when modal opens
  useEffect(() => {
    if (!isOpen || !fileData) {
      setParsedResult(null);
      setParseError(null);
      setIsAnalyzing(false);
      setIsProcessing(false);
      setIsCreatingFolder(false);
      setNewFolderName('');
      return;
    }

    let isCancelled = false;

    const runAnalysis = async () => {
      setIsAnalyzing(true);
      setParseError(null);
      try {
        const result = await parsePdfDocument(fileData.buffer, fileData.file.name);
        if (!isCancelled) {
          setParsedResult(result);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF parsing failed:', err);
          setParseError(err.message || 'PDF analiz edilemedi.');
        }
      } finally {
        if (!isCancelled) {
          setIsAnalyzing(false);
        }
      }
    };

    runAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, fileData]);

  if (!isOpen || !fileData) return null;

  const fileName = fileData.file.name;
  const fileSizeMb = (fileData.file.size / (1024 * 1024)).toFixed(2);

  // Helper: Save original PDF into the chosen folder's .attachments
  const saveOriginalPdf = async (noteTitle: string): Promise<string> => {
    const fakeNoteId = selectedFolder ? `${selectedFolder}/${noteTitle}.md` : `${noteTitle}.md`;
    const buffer = await fileData.file.arrayBuffer();
    return await storage.saveImageBytes(fakeNoteId, fileName, new Uint8Array(buffer));
  };

  // Helper: Sanitize title for note filename
  const getCleanNoteTitle = (titleProposal?: string): string => {
    const raw = titleProposal || fileName.replace(/\.pdf$/i, '');
    return raw.replace(/[\\/:*?"<>|]/g, '-').trim() || 'PDF-Notu';
  };

  // Helper: Inline Create Subfolder
  const handleCreateFolder = async () => {
    const cleanName = newFolderName.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!cleanName) return;
    try {
      await createFolder(cleanName, selectedFolder);
      const newPath = selectedFolder ? `${selectedFolder}/${cleanName}` : cleanName;
      setSelectedFolder(newPath);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  // Helper: Open the newly created note and navigate automatically
  const openCreatedNote = async (noteId: string) => {
    const cleanId = noteId.replace(/\.md$/, '');
    await useNoteStore.getState().loadVault();
    await useNoteStore.getState().selectNote(noteId);
    useUiStore.getState().setViewMode('notes');
    window.location.hash = `#/notes/${encodeURIComponent(cleanId)}`;
    onNoteCreated(noteId);
    onClose();
  };

  // ─── 1. Action: Araştırma Notu (Structured Markdown) ───
  const handleStructuredMarkdown = async () => {
    if (!parsedResult) return;
    setIsProcessing(true);
    setStatusMessage('Orijinal PDF kaydediliyor ve not oluşturuluyor...');

    try {
      const title = getCleanNoteTitle(parsedResult.title);
      const relPdfPath = await saveOriginalPdf(title);

      const content = [
        `> [!NOTE] 📄 Kaynak Belge`,
        `> Dosya: **${fileName}** (${parsedResult.pageCount} sayfa)`,
        `> Orijinal PDF: [[${relPdfPath}]]`,
        '',
        parsedResult.structuredMarkdown,
      ].join('\n');

      const noteId = await useNoteStore.getState().createNote(title, selectedFolder);
      await storage.writeNote(noteId, content);
      await openCreatedNote(noteId);
    } catch (err: any) {
      console.error('Failed to create structured note:', err);
      setParseError(err.message || 'Not oluşturulurken bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 2. Action: Yerel OCR Taraması ───
  const handleOcrExtraction = async () => {
    if (!parsedResult) return;
    setIsProcessing(true);
    setStatusMessage('Yerel OCR motoru başlatılıyor...');

    try {
      const title = getCleanNoteTitle(`${parsedResult.title || fileName}-OCR`);
      const relPdfPath = await saveOriginalPdf(title);

      const ocrPages = await performLocalOcrOnPdf(fileData.buffer, (info) => {
        setStatusMessage(`${info.status} (%${info.percent})`);
      });

      const pagesContent = ocrPages
        .map((p) => `### Sayfa ${p.pageNumber}\n\n${p.text || '_Bu sayfada optik metin algılanamadı._'}`)
        .join('\n\n---\n\n');

      const content = [
        `# ${title}`,
        '',
        `> [!INFO] 🔍 Taranmış Doküman Metni (Yerel OCR)`,
        `> Belge: [[${relPdfPath}]] • Sayfa Sayısı: ${parsedResult.pageCount}`,
        `> *Not: Bu içerik taranmış sayfalardan yerel OCR motoru (WASM) ile optik olarak ayıklanmıştır.*`,
        '',
        pagesContent,
      ].join('\n');

      const noteId = await useNoteStore.getState().createNote(title, selectedFolder);
      await storage.writeNote(noteId, content);
      await openCreatedNote(noteId);
    } catch (err: any) {
      console.error('Failed to create OCR note:', err);
      setParseError(err.message || 'OCR notu oluşturulamadı.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 3. Action: Okuyucu & Alıntı Şablonu ───
  const handleReaderExcerpt = async () => {
    if (!parsedResult) return;
    setIsProcessing(true);
    setStatusMessage('Okuma şablonu hazırlanıyor...');

    try {
      const title = getCleanNoteTitle(`${parsedResult.title || fileName}-Okuma-Notu`);
      const relPdfPath = await saveOriginalPdf(title);

      const content = [
        `# ${title}`,
        '',
        `> [!TIP] 📖 Referans Kaynak`,
        `> Orijinal Dosya: [[${relPdfPath}]] • Toplam: ${parsedResult.pageCount} Sayfa`,
        '',
        `## 📌 Önemli Alıntılar ve Referanslar`,
        `> [!QUOTE] Alıntı 1`,
        `> *""* — [[${relPdfPath}#page=1]]`,
        '',
        `## 💡 Kendi Notlarım & Yorumlar`,
        `- `,
        '',
        `## 🔗 İlgili Notlar & Konular`,
        `- `,
      ].join('\n');

      const noteId = await useNoteStore.getState().createNote(title, selectedFolder);
      await storage.writeNote(noteId, content);
      useUiStore.getState().openPdfSplitReader(relPdfPath, 1);
      await openCreatedNote(noteId);
    } catch (err: any) {
      console.error('Failed to create reader note:', err);
      setParseError(err.message || 'Okuma notu oluşturulamadı.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 4. Action: AI Sentezi & Literatür Özeti ───
  const handleAiSynthesis = async () => {
    if (!parsedResult) return;
    setIsProcessing(true);
    setStatusMessage('Yapay zeka belgeyi analiz ediyor...');

    try {
      const title = getCleanNoteTitle(`${parsedResult.title || fileName}-AI-Özet`);
      const relPdfPath = await saveOriginalPdf(title);

      // Extract sample text (up to 7000 chars) for prompt
      const sampleText = parsedResult.pages
        .slice(0, 8)
        .map((p) => p.text)
        .join('\n\n')
        .slice(0, 7000);

      const aiSettings = useAiStore.getState().settings;
      let aiAnalysisText = '';

      if (aiSettings.enabled) {
        try {
          const prompt = `Aşağıdaki akademik/araştırma belgesini analiz et. Şu bölümleri içeren profesyonel bir Türkçe araştırma özeti hazırla:
1. 📌 Yönetici Özeti (Executive Summary)
2. 🎯 Temel Hipotez ve Araştırma Soruları
3. ⚡ Metodoloji ve Bulgular
4. 💡 Kritik Değerlendirme ve Çıkarımlar
5. 🏷️ Önerilen Etiketler (Tags)

Belge Metni:
${sampleText}`;

          let fullAiText = '';
          const result = await llmClient.streamChat(
            aiSettings,
            [{ role: 'user', content: prompt }],
            (chunk) => {
              fullAiText += chunk;
            }
          );
          aiAnalysisText = result?.content || fullAiText;
        } catch (aiErr) {
          console.warn('AI call failed, falling back to template:', aiErr);
        }
      }

      const content = [
        `# ${title}`,
        '',
        `> [!NOTE] 🧠 AI Literatür Sentezi`,
        `> Kaynak: [[${relPdfPath}]] • Sayfa Sayısı: ${parsedResult.pageCount}`,
        '',
        aiAnalysisText
          ? aiAnalysisText
          : [
              `## 📌 Yönetici Özeti`,
              `- Belge: ${fileName}`,
              `- Sayfa: ${parsedResult.pageCount}`,
              '',
              `## 🎯 Temel Hipotez ve Bulgular`,
              `- `,
              '',
              `## 💡 Metodoloji & Çıkarımlar`,
              `- `,
            ].join('\n'),
      ].join('\n');

      const noteId = await useNoteStore.getState().createNote(title, selectedFolder);
      await storage.writeNote(noteId, content);
      await openCreatedNote(noteId);
    } catch (err: any) {
      console.error('Failed to create AI synthesis note:', err);
      setParseError(err.message || 'AI sentezi oluşturulamadı.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/80 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {t('pdfImportWizard', 'Akıllı PDF İçe Aktarma')}
              </h2>
              <p className="text-[11px] text-gray-500">
                Araştırma dokümanını not ağınıza bağlayın
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>

        {/* File Metadata Chip */}
        <div className="px-5 py-2.5 bg-gray-100/60 dark:bg-zinc-800/50 border-b border-gray-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate min-w-0 pr-2">
            <FileText size={14} className="text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{fileName}</span>
            <span className="text-gray-400 shrink-0 font-mono text-[11px]">({fileSizeMb} MB)</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAnalyzing ? (
              <div className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                <Loader2 size={12} className="animate-spin" />
                <span>Analiz ediliyor...</span>
              </div>
            ) : parsedResult ? (
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {parsedResult.pageCount} Sayfa
                </span>
                {parsedResult.isScanned && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Taranmış / Görsel
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Target Folder Selector & Creator */}
        <div className="px-5 py-2.5 bg-gray-50/80 dark:bg-zinc-800/30 border-b border-gray-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 shrink-0">
            <Folder size={14} className="text-purple-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Hedef Klasör:</span>
          </div>

          {!isCreatingFolder ? (
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                disabled={isProcessing}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-gray-800 dark:text-gray-200 font-mono truncate max-w-[240px] focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer disabled:opacity-50"
              >
                <option value="">/ (Kök Vault)</option>
                {folderList.map((f) => (
                  <option key={f} value={f}>
                    /{f}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                disabled={isProcessing}
                className="px-2 py-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-purple-500/20 disabled:opacity-50"
                title="Yeni Klasör Oluştur"
              >
                <FolderPlus size={12} />
                <span>+ Yeni</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <input
                type="text"
                autoFocus
                placeholder="Klasör adı..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                className="px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-purple-500 rounded-md text-gray-800 dark:text-gray-200 focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="p-1 text-emerald-600 hover:bg-emerald-500/10 rounded cursor-pointer"
                title="Oluştur"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                title="İptal"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {parseError && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Action Selection Cards */}
        <div className="p-5 space-y-2.5 overflow-y-auto max-h-[360px]">
          {/* Card 1: Araştırma Notu */}
          <button
            onClick={handleStructuredMarkdown}
            disabled={isAnalyzing || isProcessing || !parsedResult}
            className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500/80 bg-white dark:bg-zinc-900 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-start gap-3.5"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <FileCode2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Araştırma Notu Olarak Yapılandır
                </span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">
                  Önerilen
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Başlıkları, listeleri, çift sütunları ve paragrafları seçilen klasörde düzenlenebilir Markdown notuna dönüştürür.
              </p>
            </div>
          </button>

          {/* Card 2: Yerel OCR Taraması */}
          <button
            onClick={handleOcrExtraction}
            disabled={isAnalyzing || isProcessing || !parsedResult}
            className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500/80 bg-white dark:bg-zinc-900 hover:bg-amber-500/5 dark:hover:bg-amber-500/5 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-start gap-3.5"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <ScanText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Yerel OCR & Metin Çıkarma
                </span>
                {parsedResult?.isScanned && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                    Taranmış Belge
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Taranmış sayfalardaki metinleri ayıklar; global aramada (Cmd+K) aranabilir kılar.
              </p>
            </div>
          </button>

          {/* Card 3: Okuyucu & Alıntı Şablonu */}
          <button
            onClick={handleReaderExcerpt}
            disabled={isAnalyzing || isProcessing || !parsedResult}
            className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500/80 bg-white dark:bg-zinc-900 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-start gap-3.5"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <BookOpen size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Okuyucu & Alıntı Şablonu
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                PDF dosyasını ekte saklar; sayfaya referanslı alıntı ve okuma notları şablonu oluşturur.
              </p>
            </div>
          </button>

          {/* Card 4: AI Sentezi & Literatür Özeti */}
          <button
            onClick={handleAiSynthesis}
            disabled={isAnalyzing || isProcessing || !parsedResult}
            className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500/80 bg-white dark:bg-zinc-900 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-start gap-3.5"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                AI Sentezi & Literatür Özeti
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Yapay zeka ile ana hipotez, metodoloji ve kritik bulguları çıkararak yapısal özet hazırlar.
              </p>
            </div>
          </button>
        </div>

        {/* Footer with Processing State */}
        <div className="px-5 py-3.5 border-t border-gray-200/80 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
              <Loader2 size={13} className="animate-spin" />
              <span>{statusMessage}</span>
            </div>
          ) : (
            <span className="text-gray-400 text-[11px]">
              Orijinal PDF, seçilen klasörün .attachments dizinine kaydedilir
            </span>
          )}

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('cancel', 'İptal')}
          </button>
        </div>
      </div>
    </div>
  );
};
