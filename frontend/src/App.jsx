import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
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
import {
  WORKSPACES,
  parsePath,
  buildPath,
  isViewAllowed,
  defaultViewFor,
} from './lib/routing.js';

const HomeView = lazy(() => import('./components/HomeView.jsx'));
const UploaderView = lazy(() => import('./components/UploaderView.jsx'));
const DashboardView = lazy(() => import('./components/DashboardView.jsx'));
const DeliveryView = lazy(() => import('./components/DeliveryView.jsx'));
const VoixOffView = lazy(() => import('./components/VoixOffView.jsx'));
const EditorView = lazy(() => import('./components/EditorView.jsx'));
const StatsView = lazy(() => import('./components/StatsView.jsx'));
const ReporterHomeView = lazy(() => import('./components/ReporterHomeView.jsx'));
import LoginView from './components/LoginView.jsx';

function LoadingFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <SkeletonCard count={3} />
    </div>
  );
}

function currentPathname() {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

function AppShell() {
  useVersionCheck(); // Hook silencieux qui forcera le reload si nouvelle version
  const { t } = useI18n();

  // L'URL est la source de vérité : elle porte l'espace de travail (montage
  // ou reportage) ET la vue courante. Voir lib/routing.js.
  const [route, setRoute] = useState(() => parsePath(currentPathname()));
  const { workspace, view: currentView } = route;
  const isReporter = workspace === WORKSPACES.REPORTER;

  // Lu par navigate() sans le remettre en dépendance : évite de recréer le
  // callback (et donc de relancer les effets qui en dépendent) à chaque vue.
  const routeRef = useRef(route);
  routeRef.current = route;

  const navigate = useCallback((nextView, { replace = false } = {}) => {
    const target = routeRef.current.workspace;
    // Garde-fou : une vue hors périmètre de l'espace retombe sur son accueil.
    // C'est ce qui empêche un lien /journalistes/montage d'exister.
    const view = isViewAllowed(target, nextView) ? nextView : defaultViewFor(target);
    const path = buildPath(target, view);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      const url = `${path}${window.location.search}${window.location.hash}`;
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
    setRoute((prev) => (prev.view === view ? prev : { ...prev, view }));
  }, []);

  // Boutons Précédent/Suivant du navigateur.
  useEffect(() => {
    const onPopState = () => setRoute(parsePath(currentPathname()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Canonicalisation au chargement : `/` → `/monteurs`, `/journaliste` →
  // `/journalistes`, une vue inconnue → l'accueil de l'espace. L'utilisateur
  // repart toujours avec une URL propre, partageable telle quelle.
  useEffect(() => {
    const path = buildPath(route.workspace, route.view);
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', `${path}${window.location.search}${window.location.hash}`);
    }
    // Volontairement au montage uniquement : navigate() gère la suite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedWeek, setSelectedWeekState] = useState(() => {
    try {
      return localStorage.getItem('jt-selected-week') || '';
    } catch {
      return '';
    }
  });

  const setSelectedWeek = (weekId) => {
    setSelectedWeekState(weekId);
    try {
      if (weekId) localStorage.setItem('jt-selected-week', weekId);
    } catch {}
  };

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
        const saved = localStorage.getItem('jt-selected-week');
        const match = saved && w.find((wk) => wk.id === saved);
        const active = w.find((wk) => wk.status === 'active');
        if (match) {
          setSelectedWeekState(match.id);
        } else if (active) {
          setSelectedWeekState(active.id);
          localStorage.setItem('jt-selected-week', active.id);
        } else if (w.length > 0) {
          setSelectedWeekState(w[0].id);
          localStorage.setItem('jt-selected-week', w[0].id);
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
    // Le badge « nouveaux uploads » sert au suivi côté montage. Inutile de
    // faire payer ce polling aux journalistes (souvent en 4G limitée).
    if (isReporter) return;

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
  }, [selectedWeek, currentView, addToast, isAuthenticated, isReporter]);

  useEffect(() => {
    if (currentView === 'dashboard') {
      setNewUploadsCount(0);
    }
  }, [currentView]);

  // Lien direct vers l'envoi sans pays choisi (favori, lien partagé) : on
  // renvoie sur la liste des pays plutôt que d'afficher un écran vide.
  useEffect(() => {
    if (currentView === 'uploader' && !selectedCountry) {
      navigate('home', { replace: true });
    }
  }, [currentView, selectedCountry, navigate]);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    navigate('uploader');
  };

  if (isAuthenticated === null) {
    return <LoadingFallback />; // check en cours, évite le flash login
  }
  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  const isEditorWorkspace = !isReporter && currentView === 'dashboard' && isDesktopEditorAvailable;
  // L'accueil journalistes doit rester un écran à deux boutons : les bulles
  // flottantes (aide WhatsApp, assistant) recouvraient les cartes sur mobile
  // et dupliquaient le bloc d'aide déjà présent dans la page.
  const isReporterHub = isReporter && currentView === 'hub';
  const canRender = (view) => isViewAllowed(workspace, view);

  return (
    // Le padding bas réserve la place de la barre d'onglets mobile ;
    // l'accueil journalistes n'en a pas.
    <div className={`app-shell flex flex-col ${
      isEditorWorkspace ? 'h-dvh overflow-hidden' : isReporterHub ? '' : 'pb-[72px] sm:pb-0'
    }`}>
      <Nav
        currentView={currentView}
        setCurrentView={navigate}
        newUploadsCount={newUploadsCount}
        isDesktopEditorAvailable={isDesktopEditorAvailable}
        workspace={workspace}
      />

      <main className={`flex-1 ${isEditorWorkspace ? 'min-h-0 overflow-hidden pb-0' : 'pb-12'}`}>
        {isLoading ? (
          <LoadingFallback />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {canRender('hub') && (
              <div className={currentView === 'hub' ? 'block' : 'hidden'}>
                <ReporterHomeView
                  onOpenReports={() => navigate('home')}
                  onOpenDelivery={() => navigate('delivery')}
                />
              </div>
            )}
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
                  onBack={() => navigate('home')}
                  isActive={currentView === 'uploader'}
                />
              </div>
            )}
            {canRender('dashboard') && (
              <div className={currentView === 'dashboard'
                ? (isDesktopEditorAvailable ? 'h-full min-h-0' : 'block')
                : 'hidden'
              }>
                <DashboardView
                  weeks={weeks}
                  selectedWeek={selectedWeek}
                  setSelectedWeek={setSelectedWeek}
                  countries={countries}
                  isActive={currentView === 'dashboard'}
                  isDesktopEditorAvailable={isDesktopEditorAvailable}
                />
              </div>
            )}
            <div className={currentView === 'delivery' ? 'block' : 'hidden'}>
              <DeliveryView
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                isActive={currentView === 'delivery'}
                audience={isReporter ? 'reporter' : 'editor'}
              />
            </div>
            {canRender('voixoff') && (
              <div className={currentView === 'voixoff' ? 'block' : 'hidden'}>
                <VoixOffView
                  weeks={weeks}
                  selectedWeek={selectedWeek}
                  setSelectedWeek={setSelectedWeek}
                  countries={countries}
                  isActive={currentView === 'voixoff'}
                />
              </div>
            )}
            {canRender('stats') && (
              <div className={currentView === 'stats' ? 'block' : 'hidden'}>
                <StatsView
                  weeks={weeks}
                  selectedWeek={selectedWeek}
                  setSelectedWeek={setSelectedWeek}
                  isActive={currentView === 'stats'}
                />
              </div>
            )}
            {/* EditorView n'est qu'une redirection vers le studio de montage.
                Montée en permanence (même masquée), son effet de redirection
                partait à chaque chargement et forçait l'onglet Montage. */}
            {canRender('editor') && currentView === 'editor' && (
              <div>
                <EditorView isActive setCurrentView={navigate} />
              </div>
            )}
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
      {!isEditorWorkspace && !isReporterHub && <HelpButton />}
      {!isEditorWorkspace && !isReporterHub && <AIAssistant currentPage={currentView} />}
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
