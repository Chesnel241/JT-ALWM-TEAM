import { LayoutDashboard, Sparkles, Mic, MapPin } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useState, useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import NotificationToggle from './NotificationToggle.jsx';

export default function Nav({ currentView, setCurrentView, newUploadsCount }) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getNavClass = (isActive) => 
    `flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all font-medium text-xs sm:text-sm flex-1 sm:flex-none ${
      isActive 
        ? 'bg-[var(--accent)] text-white shadow-md scale-105 sm:scale-100' 
        : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--paper-2)]'
    }`;

  const navItems = [
    {
      id: 'tour-country-list', // Surtout utilisé sur mobile pour la visite
      view: 'home',
      icon: <MapPin size={20} className="sm:w-[18px] sm:h-[18px]" />,
      label: t.nav.correspondents,
      match: ['home', 'uploader']
    },
    {
      id: 'tour-nav-dashboard',
      view: 'dashboard',
      icon: <LayoutDashboard size={20} className="sm:w-[18px] sm:h-[18px]" />,
      label: t.nav.editing,
      match: ['dashboard'],
      badge: newUploadsCount > 0 ? newUploadsCount : null
    },
    {
      id: 'tour-nav-voixoff',
      view: 'voixoff',
      icon: <Mic size={20} className="sm:w-[18px] sm:h-[18px]" />,
      label: 'Voix Off',
      match: ['voixoff']
    },
    {
      id: 'tour-nav-delivery',
      view: 'delivery',
      icon: <Sparkles size={20} className="sm:w-[18px] sm:h-[18px]" />,
      label: t.nav.delivery,
      match: ['delivery']
    }
  ];

  return (
    <>
      {/* HEADER TOP */}
      <nav className="border-b border-[var(--border)] bg-[var(--paper)] sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-lwm.png"
              alt="Logo ALWM"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-contain"
            />
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">{t.nav.brand}</p>
              <h1 className="text-lg sm:text-xl font-semibold text-[color:var(--ink)]">{t.nav.tagline}</h1>
            </div>
          </div>
          
          {/* Top Actions (always visible) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationToggle />
            <LanguageSwitcher />
          </div>

          {/* Desktop nav (hidden on mobile) */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {navItems.map(item => (
              <button
                key={`desktop-${item.view}`}
                id={!isMobile ? item.id : undefined}
                onClick={() => setCurrentView(item.view)}
                className={getNavClass(item.match.includes(currentView))}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge && item.match.includes('dashboard') && currentView !== 'dashboard' && (
                    <span className="absolute -top-2 -right-2 bg-[var(--signal)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--paper)] border-t border-[var(--border)] z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-1">
        <div className="flex justify-around items-center p-2 pt-3">
          {navItems.map(item => (
            <button
              key={`mobile-${item.view}`}
              id={isMobile ? item.id : undefined} 
              onClick={() => setCurrentView(item.view)}
              className={getNavClass(item.match.includes(currentView))}
            >
              <div className="relative mb-1">
                {item.icon}
                {item.badge && item.match.includes('dashboard') && currentView !== 'dashboard' && (
                  <span className="absolute -top-2 -right-2 bg-[var(--signal)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight truncate w-full text-center px-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
