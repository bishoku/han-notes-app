import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { NotesRouteWrapper } from '@/components/NotesRouteWrapper';
import { TasksView } from '@/components/TasksView';
import { DecisionsView } from '@/components/DecisionsView';
import { MindmapView } from '@/components/MindmapView';
import { SearchView } from '@/components/search/SearchView';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<NotesRouteWrapper />} />
          <Route path="/notes" element={<NotesRouteWrapper />} />
          <Route path="/notes/*" element={<NotesRouteWrapper />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/decisions" element={<DecisionsView />} />
          <Route path="/mindmap" element={<MindmapView />} />
          <Route path="/search" element={<SearchView />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Route>
      </Routes>
      <PwaUpdateBanner />
    </HashRouter>
  );
}

export default App;
