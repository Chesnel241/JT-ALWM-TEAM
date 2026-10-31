import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Sparkles, X, ChevronRight, Clock } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import AddCountryDialog from './AddCountryDialog.jsx';
import CountryAvatar from './CountryAvatar.jsx';

/**
 * Choisir son pays.
 *
 * Une grille de grandes tuiles à drapeau : on reconnaît son pays à son
 * drapeau avant de lire son nom, et une tuile entière se touche du pouce.
 * Le dernier pays ouvert est proposé en tête, en vert, pour revenir en un
 * geste. La recherche est en grand, avec un bouton pour l'effacer.
 *
 * Il y avait deux écrans — une liste pour le téléphone, une autre pour
 * l'ordinateur — qui divergeaient (le compteur de l'un était écrit en
 * français en dur). Il n'y en a plus qu'un, qui s'adapte.
 */
export default function HomeView({ countries, onSelectCountry, onCountryAdded }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastCountryId, setLastCountryId] = useState(null);
  const champ = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('last_selected_country_id');
      if (saved) setLastCountryId(saved);
    } catch {
      // Stockage indisponible : pas de raccourci, rien de plus.
    }
  }, []);

  const handleSelectCountry = (country) => {
    try {
      localStorage.setItem('last_selected_country_id', country.id);
      setLastCountryId(country.id);
    } catch {
      // Idem.
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
      .replace(/[̀-ͯ]/g, '');

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

  const effacer = () => {
    setSearchQuery('');
    champ.current?.focus();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-6 sm:space-y-8">
      <header className="jr-ciel px-4 py-6 sm:py-10 text-center">
        <span className="badge bg-[var(--paper)] text-[color:var(--accent-deep)] shadow-sm">
          {t.home.badge}
        </span>
        <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[color:var(--ink)] leading-tight">
          {t.home.title}
        </h2>
        <p className="mt-2 text-sm sm:text-lg text-[color:var(--muted)] max-w-2xl mx-auto">
          {t.home.intro}
        </p>

        <div className="mt-5 sm:mt-7 max-w-xl mx-auto">
          <div className="jr-recherche relative">
            <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--accent)] pointer-events-none" />
            <input
              ref={champ}
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.home.searchPh}
              aria-label={t.home.searchPh}
              className="w-full min-h-[60px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] pl-14 pr-14 text-base sm:text-lg font-semibold text-[color:var(--ink)] placeholder:font-normal placeholder:text-[color:var(--muted)] shadow-sm focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent)]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={effacer}
                aria-label={t.home.clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-xl flex items-center justify-center text-[color:var(--muted)] hover:bg-[var(--paper-2)] active:scale-90 motion-tap"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[color:var(--muted)]">
            <span className="font-bold text-[color:var(--ink)]">{t.home.countCount(filteredCountries.length)}</span>
            <span className="flex items-center gap-1">
              <Clock size={13} /> {t.home.reminderText}
            </span>
          </p>
        </div>
      </header>

      {lastCountry && !searchQuery && (
        <button
          type="button"
          onClick={() => handleSelectCountry(lastCountry)}
          aria-label={t.home.enterAria(lastCountry.name)}
          className="jr-reprise w-full flex items-center gap-4 p-4 sm:p-5 text-left motion-rise focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action)]/40"
        >
          <span className="jr-drapeau">
            <CountryAvatar country={lastCountry} ring className="h-16 w-16 sm:h-20 sm:w-20" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--action-deep)]">
              <Sparkles size={14} /> {t.home.lastAccess}
            </span>
            <span className="block text-2xl sm:text-3xl font-extrabold text-[color:var(--ink)] leading-tight truncate">
              {lastCountry.name}
            </span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 min-h-[52px] px-5 rounded-2xl bg-[var(--action)] text-white font-extrabold shadow-md shadow-[var(--action)]/25">
            {t.home.open}
            <ChevronRight size={20} />
          </span>
        </button>
      )}

      <section aria-labelledby="choix-pays">
        <h3 id="choix-pays" className="mb-3 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">
          {t.home.sectionTitle}
        </h3>

        {filteredCountries.length > 0 ? (
          <div id="tour-country-list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 motion-stagger">
            {filteredCountries.map((country, index) => (
              <button
                key={country.id}
                type="button"
                style={{ '--i': index }}
                onClick={() => handleSelectCountry(country)}
                aria-label={t.home.enterAria(country.name)}
                data-dernier={country.id === lastCountryId ? '' : undefined}
                className="jr-tuile focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
              >
                <span className="jr-tuile-drapeau">
                  <CountryAvatar country={country} ring className="h-16 w-16 sm:h-20 sm:w-20" />
                </span>
                <span className="block w-full text-base sm:text-lg font-extrabold text-[color:var(--ink)] leading-tight break-words">
                  {country.name}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  {t.home.countryRole}
                </span>
                <span className="jr-tuile-entrer">
                  {t.home.enter}
                  <ChevronRight size={15} />
                </span>
              </button>
            ))}

            <button
              id="tour-add-country"
              type="button"
              style={{ '--i': filteredCountries.length }}
              onClick={() => setAddOpen(true)}
              aria-label={t.home.addCountryAria}
              className="jr-tuile jr-tuile-ajout focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--cta-orange)]/40"
            >
              <span className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center bg-[var(--cta-orange)] text-white shadow-md">
                <Plus size={32} />
              </span>
              <span className="text-base sm:text-lg font-extrabold leading-tight">{t.home.addCountry}</span>
            </button>
          </div>
        ) : (
          <div className="p-8 text-center bg-[var(--paper)] rounded-3xl border-2 border-dashed border-[var(--border)]">
            <p className="text-base font-semibold text-[color:var(--ink)]">{t.home.noMatch(searchQuery)}</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label={t.home.addCountryAria}
              className="mt-4 inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-[var(--cta-orange)] text-white font-extrabold shadow-md active:scale-95 motion-tap"
            >
              <Plus size={20} />
              <span>{t.home.addThis}</span>
            </button>
          </div>
        )}
      </section>

      <AddCountryDialog
        isOpen={addOpen}
        onCancel={() => setAddOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </div>
  );
}
