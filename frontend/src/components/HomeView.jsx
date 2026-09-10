import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Sparkles, X, ChevronRight, Clock } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import AddCountryDialog from './AddCountryDialog.jsx';
import CountryAvatar from './CountryAvatar.jsx';

export default function HomeView({ countries, onSelectCountry, onCountryAdded }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastCountryId, setLastCountryId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('last_selected_country_id');
      if (saved) setLastCountryId(saved);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleSelectCountry = (country) => {
    try {
      localStorage.setItem('last_selected_country_id', country.id);
      setLastCountryId(country.id);
    } catch {
      // Ignore
    }
    onSelectCountry(country);
  };

  const handleConfirmAdd = async (payload) => {
    const created = await api.createCountry(payload);
    onCountryAdded?.(created);
    setAddOpen(false);
    addToast(t.addCountry.successToast(created.name), 'success', 3000);
  };

  const normalize = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const q = normalize(searchQuery);
    return countries.filter(
      (c) => normalize(c.name).includes(q) || normalize(c.code).includes(q) || normalize(c.id).includes(q)
    );
  }, [countries, searchQuery]);

  const lastCountry = useMemo(() => {
    if (!lastCountryId) return null;
    return countries.find((c) => c.id === lastCountryId);
  }, [countries, lastCountryId]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
      {/* ======================= MOBILE VIEW (md:hidden) ======================= */}
      <div className="md:hidden space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] text-[10px]">
              {t.home.badge}
            </span>
            <h2 className="text-xl font-bold text-[color:var(--ink)] mt-1">
              {t.home.title}
            </h2>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            aria-label={t.home.addCountryAria}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold shadow-sm active:scale-95 transition-transform"
          >
            <Plus size={16} />
            <span>{t.home.addCountry}</span>
          </button>
        </div>

        {/* Quick Resume Card (if last country exists) */}
        {lastCountry && !searchQuery && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[var(--accent)]/15 via-[var(--accent)]/5 to-[var(--paper-2)] border border-[var(--accent)]/30 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CountryAvatar country={lastCountry} className="h-11 w-11 shadow-sm" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[color:var(--accent-deep)]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent-deep)]">
                      Dernier accès
                    </span>
                  </div>
                  <p className="text-base font-bold text-[color:var(--ink)] leading-tight">
                    {lastCountry.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSelectCountry(lastCountry)}
                type="button"
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold shadow-md shadow-[var(--accent)]/20 active:scale-95 motion-tap flex items-center gap-1"
              >
                <span>Ouvrir</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Search Bar & Country Count */}
        <div className="space-y-2">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-[color:var(--muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un pays (ex: Gabon, CI, Sénégal)..."
              className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-xl pl-10 pr-9 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-[color:var(--muted)] p-1 active:scale-90"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">
              {filteredCountries.length} {filteredCountries.length > 1 ? 'pays disponibles' : 'pays'}
            </span>
            <span className="text-[11px] text-[color:var(--muted)] flex items-center gap-1">
              <Clock size={12} /> {t.home.retention}
            </span>
          </div>
        </div>

        {/* Country Grid (Mobile tactile cards) */}
        <div className="grid grid-cols-1 gap-2.5">
          {filteredCountries.map((country) => (
            <button
              key={`mobile-${country.id}`}
              onClick={() => handleSelectCountry(country)}
              type="button"
              aria-label={t.home.enterAria(country.name)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border motion-tap active:scale-[0.98] ${
                country.id === 'tj' || country.id === 'mj'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50 shadow-sm'
                  : 'bg-[var(--paper)] border-[var(--border)] shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <CountryAvatar country={country} className="h-10 w-10 shrink-0" />
                <div className="text-left">
                  <p className="text-base font-bold text-[color:var(--ink)] leading-tight">{country.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                    {country.id === 'tj' ? 'Titres & Rappels' : country.id === 'mj' ? 'Mot du JT' : t.home.countryRole}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 px-2.5 py-1.5 rounded-xl">
                <span>{t.home.enter}</span>
                <ChevronRight size={14} />
              </div>
            </button>
          ))}

          {filteredCountries.length === 0 && (
            <div className="p-8 text-center bg-[var(--paper)] rounded-2xl border border-[var(--border)] text-[color:var(--muted)]">
              <p className="text-sm font-medium">Aucun pays ne correspond à « {searchQuery} »</p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold shadow-sm"
              >
                <Plus size={14} />
                <span>Ajouter ce pays</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================= DESKTOP VIEW (hidden md:grid) ======================= */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 lg:gap-10 items-start">
        <div className="space-y-5 sm:space-y-6">
          <div className="inline-flex items-center gap-2 badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
            {t.home.badge}
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[color:var(--ink)] leading-tight">
            {t.home.title}
          </h2>
          <p className="text-[color:var(--muted)] text-base sm:text-lg max-w-xl">
            {t.home.intro}
          </p>
          <div className="panel-soft p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">{t.home.reminderTitle}</p>
              <p className="text-lg font-semibold text-[color:var(--ink)]">{t.home.reminderText}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[var(--signal)]/15 flex items-center justify-center text-[color:var(--signal)] font-semibold">
              {t.home.retention}
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">{t.home.sectionTitle}</h3>
            <span className="badge bg-[var(--paper)] text-[color:var(--muted)]">{t.home.countCount(countries.length)}</span>
          </div>
          <div id="tour-country-list" className="space-y-2">
            {countries.map((country, index) => (
              <button
                key={country.id}
                onClick={() => handleSelectCountry(country)}
                type="button"
                aria-label={t.home.enterAria(country.name)}
                className={`w-full flex items-center justify-between px-4 py-3 sm:py-4 rounded-2xl border motion-tap active:scale-[0.98] active:opacity-80 sm:hover:shadow-[var(--shadow-soft)] ${
                  country.id === 'tj' || country.id === 'mj'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 sm:hover:border-amber-400'
                    : `border-[var(--border)] sm:hover:border-[color:var(--accent)] ${index % 2 === 0 ? 'bg-[var(--paper)]' : 'bg-[var(--paper-2)]'}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <CountryAvatar country={country} className="h-10 w-10" />
                  <div className="text-left">
                    <p className="text-base font-semibold text-[color:var(--ink)]">{country.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">{t.home.countryRole}</p>
                  </div>
                </div>
                <span className="text-sm text-[color:var(--muted)]">{t.home.enter}</span>
              </button>
            ))}

            <button
              id="tour-add-country"
              onClick={() => setAddOpen(true)}
              type="button"
              aria-label={t.home.addCountryAria}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-4 rounded-2xl border-2 border-dashed border-[var(--border)] text-[color:var(--muted)] motion-tap font-medium active:scale-[0.98] active:opacity-80 sm:hover:border-[color:var(--accent)] sm:hover:text-[color:var(--accent-deep)] sm:hover:bg-[var(--accent)]/5"
            >
              <Plus size={18} />
              {t.home.addCountry}
            </button>
          </div>
        </div>
      </div>

      <AddCountryDialog
        isOpen={addOpen}
        onCancel={() => setAddOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </div>
  );
}
