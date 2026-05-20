import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Nav from './components/Nav.jsx';
import ToastContainer from './components/Toast.jsx';
import { ToastProvider, useToast } from './hooks/useToast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx';
import { api } from './api/index.js';
import SkeletonCard from './components/SkeletonCard.jsx';

const HomeView = lazy(() => import('./components/HomeView.jsx'));
const UploaderView = lazy(() => import('./components/UploaderView.jsx'));
const DashboardView = lazy(() => import('./components/DashboardView.jsx'));
const DeliveryView = lazy(() => import('./components/DeliveryView.jsx'));

function LoadingFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SkeletonCard count={3} />
    </div>
  );
}

function AppShell() {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState('home');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [countries, setCountries] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { addToast } = useToast();
  const [newUploadsCount, setNewUploadsCount] = useState(0);
  const previousTotalRef = useRef(null);

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

  useEffect(() => {
    if (!selectedWeek) return;

    const checkNewUploads = async () => {
      try {
        const dashboard = await api.getDashboard(selectedWeek);
        const currentTotal = Object.values(dashboard).reduce((acc, files) => acc + files.length, 0);

        if (previousTotalRef.current !== null && currentTotal > previousTotalRef.current && currentView !== 'dashboard') {
          const diff = currentTotal - previousTotalRef.current;
          setNewUploadsCount(prev => prev + diff);
          addToast(t.notifications.newUploads(diff), 'success', 4000);
        }
        previousTotalRef.current = currentTotal;
      } catch (err) {
        console.error('Upload check error:', err);
      }
    };

    // On lance la vérification initiale
    checkNewUploads();

    // Puis on vérifie toutes les 20 secondes
    const interval = setInterval(checkNewUploads, 20000);
    return () => clearInterval(interval);
  }, [selectedWeek, currentView, addToast]);

  useEffect(() => {
    if (currentView === 'dashboard') {
      setNewUploadsCount(0);
    }
  }, [currentView]);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setCurrentView('uploader');
  };

  return (
    <div className="app-shell flex flex-col">
      <Nav currentView={currentView} setCurrentView={setCurrentView} newUploadsCount={newUploadsCount} />

      <main className="flex-1 pb-12">
        {isLoading ? (
          <LoadingFallback />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {currentView === 'home' && (
              <HomeView
                countries={countries}
                onSelectCountry={handleSelectCountry}
                onCountryAdded={(c) => setCountries((prev) => [...prev, c])}
              />
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
            {currentView === 'delivery' && (
              <DeliveryView
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
              />
            )}
          </Suspense>
        )}
      </main>

      <footer className="bg-[var(--paper-2)] text-[color:var(--muted)] py-6 text-center text-sm border-t border-[var(--border)]">
        <p>{t.footer.brand}</p>
        <p className="text-xs mt-2 text-[color:var(--muted)]">
          {t.footer.retention}
        </p>
      </footer>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
