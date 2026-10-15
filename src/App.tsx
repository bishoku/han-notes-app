import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { NotesRouteWrapper } from '@/components/NotesRouteWrapper';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const TasksView = React.lazy(() =>
  import('@/components/TasksView').then((m) => ({ default: m.TasksView }))
);
const DecisionsView = React.lazy(() =>
  import('@/components/DecisionsView').then((m) => ({ default: m.DecisionsView }))
);
const MindmapView = React.lazy(() =>
  import('@/components/MindmapView').then((m) => ({ default: m.MindmapView }))
);
const SearchView = React.lazy(() =>
  import('@/components/search/SearchView').then((m) => ({ default: m.SearchView }))
);
const ClipperImportHandler = React.lazy(() =>
  import('@/components/clipper/ClipperImportHandler').then((m) => ({
    default: m.ClipperImportHandler,
  }))
);

if (typeof window !== 'undefined' && !window.name) {
  window.name = 'han_notes_app';
}

const RouteFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-mac-mainLight dark:bg-mac-mainDark">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-mac-accent border-t-transparent" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<NotesRouteWrapper />} />
              <Route path="/notes" element={<NotesRouteWrapper />} />
              <Route path="/notes/*" element={<NotesRouteWrapper />} />
              <Route path="/tasks" element={<TasksView />} />
              <Route path="/decisions" element={<DecisionsView />} />
              <Route path="/mindmap" element={<MindmapView />} />
              <Route path="/search" element={<SearchView />} />
              <Route path="/import-clip" element={<ClipperImportHandler />} />
              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/notes" replace />} />
            </Route>
          </Routes>
        </Suspense>
        <PwaUpdateBanner />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
