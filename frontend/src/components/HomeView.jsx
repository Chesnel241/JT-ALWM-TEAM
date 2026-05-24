import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import AddCountryDialog from './AddCountryDialog.jsx';
import CountryAvatar from './CountryAvatar.jsx';

export default function HomeView({ countries, onSelectCountry, onCountryAdded }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const handleConfirmAdd = async (payload) => {
    const created = await api.createCountry(payload);
    onCountryAdded?.(created);
    setAddOpen(false);
    addToast(t.addCountry.successToast(created.name), 'success', 3000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 items-start">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
            {t.home.badge}
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold text-[color:var(--ink)] leading-tight">
            {t.home.title}
          </h2>
          <p className="text-[color:var(--muted)] text-lg max-w-xl">
            {t.home.intro}
          </p>
          <div className="panel-soft p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">{t.home.reminderTitle}</p>
              <p className="text-lg font-semibold text-[color:var(--ink)]">{t.home.reminderText}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[var(--signal)]/15 flex items-center justify-center text-[color:var(--signal)] font-semibold">
              {t.home.retention}
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">{t.home.sectionTitle}</h3>
            <span className="badge bg-[var(--paper)] text-[color:var(--muted)]">{t.home.countCount(countries.length)}</span>
          </div>
          <div className="space-y-2">
            {countries.map((country, index) => (
              <button
                key={country.id}
                onClick={() => onSelectCountry(country)}
                type="button"
                aria-label={t.home.enterAria(country.name)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all hover:shadow-[var(--shadow-soft)] ${
                  country.id === 'tj' || country.id === 'mj'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-400'
                    : `border-[var(--border)] hover:border-[color:var(--accent)] ${index % 2 === 0 ? 'bg-[var(--paper)]' : 'bg-[var(--paper-2)]'}`
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
              onClick={() => setAddOpen(true)}
              type="button"
              aria-label={t.home.addCountryAria}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/5 transition-all font-medium"
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
