import { LayoutDashboard, Sparkles, Mic, Mic2, ListOrdered, MapPin, BarChart2, Upload, Download, Home, CalendarDays } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useState, useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import NotificationToggle from './NotificationToggle.jsx';
import TextSizeToggle from './TextSizeToggle.jsx';
import { WORKSPACES } from '../lib/routing.js';

export default function Nav({
  currentView,
  setCurrentView,
  newUploadsCount,
  isDesktopEditorAvailable = true,
  workspace = WORKSPACES.EDITOR,
  textSize,
  onTextSize,
}) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isReporter = workspace === WORKSPACES.REPORTER;
  const isEditorWorkspace = !isReporter && currentView === 'dashboard' && isDesktopEditorAvailable;

  // Espace journalistes : onglets plus gros (doigt + presbytie). Ils sont
  // masqués sur l'accueil, qui ne doit afficher que ses deux grands boutons.
  const showTabs = !isReporter || currentView !== 'hub';

  // La taille (dont la taille de police) est portée entièrement par `size` :
  // deux classes de police au même breakpoint dans la même chaîne laisseraient
  // l'ordre de la feuille Tailwind décider du gagnant.
  const getNavClass = (isActive) => {
    const size = isReporter
      ? 'text-[11px] sm:text-base px-2 sm:px-6 py-2 sm:py-3 rounded-2xl'
      : isEditorWorkspace
        ? 'text-xs sm:px-2.5 sm:py-2 sm:rounded-md'
        : 'text-xs sm:text-sm px-1 sm:px-4 py-2 sm:py-2.5 rounded-xl';
    return `flex min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-[transform,background-color,color,box-shadow] duration-150 font-medium flex-1 sm:flex-none ${size} ${
      isActive
        ? 'bg-[var(--accent)] text-white shadow-md scale-105 sm:scale-100'
        : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--paper-2)]'
    }`;
  };

  // Sur téléphone, la ligne « cloche + langues (+ Accueil) » libellée dépasse
  // la largeur de l'écran : on repasse ces contrôles en icônes. Les libellés
  // restent en `title`/`aria-label`, et la navigation reste dans la barre du
  // bas, plus grosse et plus lisible.
  const compactActions = isEditorWorkspace || isMobile;

  const iconSize = isReporter ? 24 : 20;
  const iconClass = isReporter ? 'sm:w-[22px] sm:h-[22px]' : 'sm:w-[18px] sm:h-[18px]';

  // Espace journalistes : reportages, voix off, les deux rubriques du
  // journal, et le téléchargement du JT.
  const reporterNavItems = [
    {
      id: 'tour-country-list',
      view: 'home',
      icon: <Upload size={iconSize} className={iconClass} />,
      label: t.reporter.uploadTab,
      match: ['home', 'uploader'],
    },
    {
      id: 'tour-nav-voixoff',
      view: 'voixoff',
      icon: <Mic size={iconSize} className={iconClass} />,
      label: t.reporter.voixOffTab || t.nav.voixOff,
      match: ['voixoff'],
    },
    {
      id: 'tour-nav-conducteur',
      view: 'conducteur',
      icon: <ListOrdered size={iconSize} className={iconClass} />,
      label: isMobile ? 'Conducteur' : 'Conducteur du JT',
      match: ['conducteur'],
    },
    {
      id: 'tour-nav-motdujt',
      view: 'motDuJt',
      icon: <Mic2 size={iconSize} className={iconClass} />,
      label: isMobile ? 'Mot du JT' : 'Le Mot du JT',
      match: ['motDuJt'],
    },
    {
      id: 'tour-nav-delivery',
      view: 'delivery',
      icon: <Download size={iconSize} className={iconClass} />,
      label: t.reporter.downloadTab,
      match: ['delivery'],
    },
  ];

  const editorNavItems = [
    {
      id: 'tour-country-list', // Surtout utilisé sur mobile pour la visite
      view: 'home',
      icon: <MapPin size={iconSize} className={iconClass} />,
      label: isMobile ? t.nav.correspondentsShort : t.nav.correspondents,
      match: ['home', 'uploader']
    },
    {
      id: 'tour-nav-dashboard',
      view: 'dashboard',
      icon: <LayoutDashboard size={iconSize} className={iconClass} />,
      label: isMobile ? t.nav.editingShort : t.nav.editing,
      match: ['dashboard'],
      badge: newUploadsCount > 0 ? newUploadsCount : null
    },
    {
      id: 'tour-nav-voixoff',
      view: 'voixoff',
      icon: <Mic size={iconSize} className={iconClass} />,
      label: t.nav.voixOff,
      match: ['voixoff']
    },
    {
      id: 'tour-nav-delivery',
      view: 'delivery',
      icon: <Sparkles size={iconSize} className={iconClass} />,
      label: t.nav.delivery,
      match: ['delivery']
    },
    {
      id: 'tour-nav-planning',
      view: 'planning',
      icon: <CalendarDays size={iconSize} className={iconClass} />,
      label: isMobile ? 'Planning' : 'Programmation',
      match: ['planning']
    },
    {
      id: 'tour-nav-stats',
      view: 'stats',
      icon: <BarChart2 size={iconSize} className={iconClass} />,
      label: isMobile ? t.nav.statsShort : t.nav.stats,
      match: ['stats']
    }
  ];

  const visibleNavItems = isReporter ? reporterNavItems : editorNavItems;

  const renderTab = (item, keyPrefix, withId) => (
    <button
      key={`${keyPrefix}-${item.view}`}
      id={withId ? item.id : undefined}
      onClick={() => setCurrentView(item.view)}
      className={getNavClass(item.match.includes(currentView))}
      aria-current={item.match.includes(currentView) ? 'page' : undefined}
    >
      <div className={keyPrefix === 'mobile' ? 'relative mb-1 shrink-0' : 'relative shrink-0'}>
        {item.icon}
        {item.badge && item.match.includes('dashboard') && currentView !== 'dashboard' && (
          <span className="absolute -top-2 -right-2 bg-[var(--signal)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
            {item.badge}
          </span>
        )}
      </div>
      <span
        className={keyPrefix === 'mobile'
          ? `leading-tight truncate w-full text-center px-1 ${isReporter ? 'text-[11px] font-semibold' : 'text-[10px]'}`
          : undefined}
      >
        {item.label}
      </span>
    </button>
  );

  const brand = (
    <>
      <img
        src="/logo-lwm.png"
        alt="Logo ALWM"
        className={`${isEditorWorkspace ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11'} shrink-0 rounded-full object-contain`}
      />
      <div className="hidden min-w-0 text-left min-[360px]:block">
        <p className={`${isEditorWorkspace ? 'text-[9px]' : 'text-[10px] sm:text-xs'} uppercase tracking-[0.3em] text-[color:var(--muted)]`}>{t.nav.brand}</p>
        <h1 className={`${isEditorWorkspace ? 'text-sm xl:text-base' : 'text-sm sm:text-xl'} truncate font-semibold text-[color:var(--ink)]`}>
          {isReporter ? (isMobile ? t.reporter.badgeShort : t.reporter.badge) : t.nav.tagline}
        </h1>
      </div>
    </>
  );

  return (
    <>
      {/* HEADER TOP */}
      <nav className="app-chrome-top shrink-0 border-b border-[var(--border)] bg-[var(--paper)] sticky top-0 z-40 shadow-sm">
        <div className={isEditorWorkspace
          ? 'mx-auto flex h-16 w-full max-w-[1920px] flex-nowrap items-center gap-3 px-4 xl:px-5'
          : 'max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-4 flex flex-wrap items-center justify-between gap-4'
        }>
          {isReporter ? (
            // Le logo ramène à l'accueil des deux boutons : un seul repère de
            // retour, toujours au même endroit.
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              aria-label={t.reporter.homeAria}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 -ml-1 transition-colors hover:bg-[var(--paper-2)] active:scale-95 sm:flex-none"
            >
              {brand}
            </button>
          ) : (
            <div className={`flex min-w-0 flex-1 items-center sm:flex-none ${isEditorWorkspace ? 'shrink-0 gap-2' : 'gap-3'}`}>
              {brand}
            </div>
          )}

          {/* Top Actions (always visible) */}
          <div className={`flex shrink-0 items-center gap-1.5 sm:gap-3 ${isEditorWorkspace ? 'order-3' : ''}`}>
            {/* Retour explicite : ne pas compter sur le seul logo cliquable,
                le repère « Accueil » doit être lisible pour tout le monde. */}
            {isReporter && currentView !== 'hub' && (
              <button
                type="button"
                onClick={() => setCurrentView('hub')}
                aria-label={t.reporter.home}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--paper-2)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[var(--paper)] active:scale-95"
              >
                <Home size={18} />
                <span className="hidden sm:inline">{t.reporter.home}</span>
              </button>
            )}
            {/* Cloche push : utile aux deux équipes (les journalistes veulent
                être prévenus dès que le JT est prêt). */}
            <NotificationToggle
              compact={compactActions}
              audience={isReporter ? 'reporter' : 'editor'}
            />
            {/* Confort de lecture : proposé aux deux équipes, sauf dans le
                studio où l'interface est dense par nature. */}
            {!isEditorWorkspace && (
              <TextSizeToggle size={textSize} onChange={onTextSize} compact={compactActions} />
            )}
            <LanguageSwitcher compact={compactActions} />
          </div>

          {/* Desktop nav (hidden on mobile) */}
          {showTabs && !isReporter && (
            <div className={`hidden min-w-0 items-center sm:flex ${isEditorWorkspace ? 'order-2 flex-1 flex-nowrap justify-center gap-1' : 'basis-full flex-wrap justify-center gap-2 lg:basis-0 lg:flex-1 lg:justify-start'}`}>
              {visibleNavItems.map((item) => renderTab(item, 'desktop', !isMobile))}
            </div>
          )}
        </div>

        {/* Espace journalistes : rangée dédiée sur ordinateur. Les deux
            onglets sont larges et centrés — coincés dans la ligne du logo,
            ils se repliaient l'un sous l'autre. */}
        {showTabs && isReporter && (
          <div className="hidden sm:block border-t border-[var(--border)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-3">
              {visibleNavItems.map((item) => (
                <div key={`desktop-wrap-${item.view}`} className="flex-1 max-w-xs flex">
                  {renderTab(item, 'desktop', !isMobile)}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* MOBILE BOTTOM NAVIGATION */}
      {showTabs && (
        <div className="app-chrome-bottom sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--paper)] border-t border-[var(--border)] z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-1">
          <div className={`flex justify-around items-center p-2 pt-3 ${isReporter ? 'gap-2' : ''}`}>
            {visibleNavItems.map((item) => renderTab(item, 'mobile', isMobile))}
          </div>
        </div>
      )}
    </>
  );
}
