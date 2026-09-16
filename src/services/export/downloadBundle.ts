import type { OkfBundle } from './okfExporter';

export function downloadBundleAsJson(bundle: OkfBundle): void {
  const exportData = {
    format: 'okf',
    version: '1.0',
    ...Object.fromEntries(bundle.files)
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `han-okf-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
