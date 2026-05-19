import { useState, useEffect, lazy, Suspense } from 'react';
import Nav from './components/Nav.jsx';
import ToastContainer from './components/Toast.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { api } from './api/index.js';
import SkeletonCard from './components/SkeletonCard.jsx';

const HomeView = lazy(() => import('./components/HomeView.jsx'));
const UploaderView = lazy(() => import('./components/UploaderView.jsx'));
const DashboardView = lazy(() => import('./components/DashboardView.jsx'));

function LoadingFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SkeletonCard count={3} />
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [countries, setCountries] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([api.getCountries(), api.getWeeks()])
      .then(([c, w]) => {
        setCountries(c);
        setWeeks(w);
        const active = w.find((wk) => wk.status === 'active');
        if (active) {
          setSelectedWeek(active.id);
        } else if (w.length > 0) {
          setSelectedWeek(w[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setCurrentView('uploader');
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="app-shell flex flex-col">
          <Nav currentView={currentView} setCurrentView={setCurrentView} />

          <main className="flex-1 pb-12">
            {isLoading ? (
              <LoadingFallback />
            ) : (
              <Suspense fallback={<LoadingFallback />}>
                {currentView === 'home' && (
                  <HomeView countries={countries} onSelectCountry={handleSelectCountry} />
                )}
                {currentView === 'uploader' && selectedCountry && (
                  <UploaderView
                    country={selectedCountry}
                    weeks={weeks}
                    selectedWeek={selectedWeek}
                    setSelectedWeek={setSelectedWeek}
                    onBack={() => setCurrentView('home')}
                  />
                )}
                {currentView === 'dashboard' && (
                  <DashboardView
                    weeks={weeks}
                    selectedWeek={selectedWeek}
                    setSelectedWeek={setSelectedWeek}
                    countries={countries}
                  />
                )}
              </Suspense>
            )}
          </main>

          <footer className="bg-[var(--paper-2)] text-[color:var(--muted)] py-6 text-center text-sm border-t border-[var(--border)]">
            <p>JT ALWM Hub, outil de centralisation des reportages.</p>
            <p className="text-xs mt-2 text-[color:var(--muted)]">
              Rétention automatique : Les fichiers sont supprimés 48h après la fin de la semaine de diffusion.
            </p>
          </footer>

          <ToastContainer />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
