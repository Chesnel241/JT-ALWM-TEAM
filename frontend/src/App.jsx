import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Nav from './components/Nav.jsx';
import ToastContainer from './components/Toast.jsx';
import HelpButton from './components/HelpButton.jsx';
import { ToastProvider, useToast } from './hooks/useToast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AIAssistant from './components/AIAssistant.jsx';
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx';
import { api } from './api/index.js';
import SkeletonCard from './components/SkeletonCard.jsx';
import { useVersionCheck } from './hooks/useVersionCheck.js';

const HomeView = lazy(() => import('./components/HomeView.jsx'));
const UploaderView = lazy(() => import('./components/UploaderView.jsx'));
const DashboardView = lazy(() => import('./components/DashboardView.jsx'));
const DeliveryView = lazy(() => import('./components/DeliveryView.jsx'));
const VoixOffView = lazy(() => import('./components/VoixOffView.jsx'));
const EditorView = lazy(() => import('./components/EditorView.jsx'));
const StatsView = lazy(() => import('./components/StatsView.jsx'));
import LoginView from './components/LoginView.jsx';

function LoadingFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SkeletonCard count={3} />
    </div>
  );
}

function AppShell() {
  useVersionCheck(); // Hook silencieux qui forcera le reload si nouvelle version
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState('home');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [countries, setCountries] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // null = inconnu (au boot), true = session valide, false = login requis.
  // Source de vérité = le cookie httpOnly côté serveur (api.checkAuth).
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isDesktopEditorAvailable, setIsDesktopEditorAvailable] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1180px)').matches : true
  ));

  useEffect(() => {
    api.checkAuth().then(setIsAuthenticated).catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1180px)');
    const update = (event) => setIsDesktopEditorAvailable(event.matches);
    setIsDesktopEditorAvailable(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!isDesktopEditorAvailable && currentView === 'dashboard') {
      setCurrentView('home');
    }
  }, [currentView, isDesktopEditorAvailable]);

  const { addToast } = useToast();
  const [newUploadsCount, setNewUploadsCount] = useState(0);
  const previousTotalRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;
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
      .catch((err) => {
        console.error(err);
        // 401 → cookie expiré/manquant → on retombe sur la page login.
        if (err.message && /session|mot de passe|unauthor/i.test(err.message)) {
          setIsAuthenticated(false);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedWeek) return;

    const checkNewUploads = async () => {
      // Onglet en arrière-plan : on ne sonde pas (économie réseau/CPU, utile
      // sur connexions 4G limitées multi-pays). Le badge se rafraîchit au
      // retour de focus.
      if (typeof document !== 'undefined' && document.hidden) return;
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

    // Vérification initiale + polling. Le temps réel sur le dashboard est
    // assuré par Socket.io ; ce polling sert le badge de notification sur
    // les autres vues, donc 45 s suffisent (réduit la charge serveur pour
    // 30 users répartis sur plusieurs continents).
    checkNewUploads();
    const interval = setInterval(checkNewUploads, 45000);
    // Rafraîchit dès que l'onglet revient au premier plan.
    const onVis = () => { if (!document.hidden) checkNewUploads(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, [selectedWeek, currentView, addToast, isAuthenticated]);

  useEffect(() => {
    if (currentView === 'dashboard') {
      setNewUploadsCount(0);
    }
  }, [currentView]);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setCurrentView('uploader');
  };

  if (isAuthenticated === null) {
    return <LoadingFallback />; // check en cours, évite le flash login
  }
  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  const isEditorWorkspace = currentView === 'dashboard' && isDesktopEditorAvailable;

  return (
    <div className={`app-shell flex flex-col ${isEditorWorkspace ? 'h-dvh overflow-hidden' : 'pb-[72px] sm:pb-0'}`}>
      <Nav
        currentView={currentView}
        setCurrentView={setCurrentView}
        newUploadsCount={newUploadsCount}
        isDesktopEditorAvailable={isDesktopEditorAvailable}
      />

      <main className={`flex-1 ${isEditorWorkspace ? 'min-h-0 overflow-hidden pb-0' : 'pb-12'}`}>
        {isLoading ? (
          <LoadingFallback />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <div className={currentView === 'home' ? 'block' : 'hidden'}>
              <HomeView
                countries={countries}
                onSelectCountry={handleSelectCountry}
                onCountryAdded={(c) => setCountries((prev) => [...prev, c])}
              />
            </div>
            {selectedCountry && (
              <div className={currentView === 'uploader' ? 'block' : 'hidden'}>
                <UploaderView
                  country={selectedCountry}
                  weeks={weeks}
                  selectedWeek={selectedWeek}
                  setSelectedWeek={setSelectedWeek}
                  onBack={() => setCurrentView('home')}
                  isActive={currentView === 'uploader'}
                />
              </div>
            )}
            {isDesktopEditorAvailable && (
              <div className={currentView === 'dashboard' ? 'h-full min-h-0' : 'hidden'}>
                <DashboardView
                  weeks={weeks}
                  selectedWeek={selectedWeek}
                  setSelectedWeek={setSelectedWeek}
                  countries={countries}
                  isActive={currentView === 'dashboard'}
                />
              </div>
            )}
            <div className={currentView === 'delivery' ? 'block' : 'hidden'}>
              <DeliveryView
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                isActive={currentView === 'delivery'}
              />
            </div>
            <div className={currentView === 'voixoff' ? 'block' : 'hidden'}>
              <VoixOffView
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                countries={countries}
                isActive={currentView === 'voixoff'}
              />
            </div>
            <div className={currentView === 'stats' ? 'block' : 'hidden'}>
              <StatsView
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                isActive={currentView === 'stats'}
              />
            </div>
            <div className={currentView === 'editor' ? 'block' : 'hidden'}>
              <EditorView
                isActive={currentView === 'editor'}
                setCurrentView={setCurrentView}
              />
            </div>
          </Suspense>
        )}
      </main>

      {!isEditorWorkspace && (
        <footer className="bg-[var(--paper-2)] text-[color:var(--muted)] py-6 text-center text-sm border-t border-[var(--border)]">
          <p>{t.footer.brand}</p>
          <p className="text-xs mt-2 text-[color:var(--muted)]">
            {t.footer.retention}
          </p>
        </footer>
      )}

      <ToastContainer />
      {!isEditorWorkspace && <HelpButton />}
      {!isEditorWorkspace && <AIAssistant currentPage={currentView} />}
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
