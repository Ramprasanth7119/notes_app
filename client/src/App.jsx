import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { PublicOnly, RequireAuth } from './components/layout/RouteGuards';
import { LoadingState } from './components/ui/States';
import AuthPage from './pages/AuthPage';
import CollectionsPage from './pages/CollectionsPage';
import NotesPage from './pages/NotesPage';
import NotFoundPage from './pages/NotFoundPage';

// Pages that pull in the markdown editor are split into their own chunks.
const NoteDetailPage = lazy(() => import('./pages/NoteDetailPage'));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage'));

const lazyPage = (Page) => (
  <Suspense fallback={<LoadingState />}>
    <Page />
  </Suspense>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<NotesPage />} />
            <Route path="notes/:id" element={lazyPage(NoteDetailPage)} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="collections/:id" element={lazyPage(CollectionDetailPage)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
