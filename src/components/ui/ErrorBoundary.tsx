import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-mac-mainLight dark:bg-mac-mainDark text-gray-800 dark:text-gray-200"
        >
          <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-900 p-6 shadow-lg">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle size={22} />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1.5">
              {this.props.fallbackTitle || 'Beklenmeyen bir hata oluştu'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 break-words font-mono bg-black/5 dark:bg-white/5 rounded-lg p-2.5">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl bg-mac-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Tekrar Dene</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Sayfayı Yenile
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
