import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import GrillePays, { RecherchePays, filtrerPays } from './GrillePays.jsx';

/**
 * Choisir son pays (page « Espace reportage »).
 *
 * Une grille de grandes tuiles à drapeau : on reconnaît son pays à son
 * drapeau avant de lire son nom, et une tuile entière se touche du pouce.
 * La recherche est en grand, avec un bouton pour l'effacer.
 *
 * Plus de « dernier accès » en tête : l'accès se fait sans compte, et le
 * pays ouvert en dernier sur un appareil ne disait rien de la personne qui
 * arrive. Chacun entre librement dans son espace par son drapeau.
 */
export default function HomeView({ countries, onSelectCountry, onCountryAdded }) {
  const { t } = useI18n();
  const [requete, setRequete] = useState('');
  const nombre = filtrerPays(countries, requete).length;

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
          <RecherchePays valeur={requete} onChange={setRequete} />
          <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[color:var(--muted)]">
            <span className="font-bold text-[color:var(--ink)]">{t.home.countCount(nombre)}</span>
            <span className="flex items-center gap-1">
              <Clock size={13} /> {t.home.reminderText}
            </span>
          </p>
        </div>
      </header>

      <section aria-labelledby="choix-pays">
        <h3 id="choix-pays" className="mb-3 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">
          {t.home.sectionTitle}
        </h3>
        <GrillePays
          countries={countries}
          requete={requete}
          onSelectCountry={onSelectCountry}
          onCountryAdded={onCountryAdded}
          idGrille="tour-country-list"
          idAjout="tour-add-country"
        />
      </section>
    </div>
  );
}
