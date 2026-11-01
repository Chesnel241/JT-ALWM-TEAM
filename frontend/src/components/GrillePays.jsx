import { useRef, useState } from 'react';
import { Plus, Search, X, ChevronRight } from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import AddCountryDialog from './AddCountryDialog.jsx';
import CountryAvatar from './CountryAvatar.jsx';

/**
 * Les drapeaux des pays : on reconnaît le sien avant de lire son nom, et on
 * le touche pour entrer dans son espace.
 *
 * Partagée par l'accueil (`variante="compacte"`, les drapeaux sous les accès
 * rapides) et par la page « Espace reportage » (`variante="grande"`). Aucun
 * pays n'est mis en avant : l'accès se fait sans compte, et un « dernier
 * pays ouvert » ne disait rien de la personne qui arrive.
 */

const sansAccents = (texte) =>
  String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Les pays dont le nom, le code ou l'identifiant contient la recherche. */
export function filtrerPays(pays, requete) {
  const liste = Array.isArray(pays) ? pays : [];
  const q = sansAccents(requete).trim();
  if (!q) return liste;
  return liste.filter(
    (c) => sansAccents(c.name).includes(q) || sansAccents(c.code).includes(q) || sansAccents(c.id).includes(q),
  );
}

/** La grande recherche, avec un bouton pour l'effacer d'un geste. */
export function RecherchePays({ valeur, onChange }) {
  const { t } = useI18n();
  const champ = useRef(null);
  return (
    <div className="jr-recherche relative">
      <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--accent)] pointer-events-none" />
      <input
        ref={champ}
        type="search"
        inputMode="search"
        autoComplete="off"
        enterKeyHint="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.home.searchPh}
        aria-label={t.home.searchPh}
        className="w-full min-h-[60px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] pl-14 pr-14 text-base sm:text-lg font-semibold text-[color:var(--ink)] placeholder:font-normal placeholder:text-[color:var(--muted)] shadow-sm focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent)]/15"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            champ.current?.focus();
          }}
          aria-label={t.home.clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-xl flex items-center justify-center text-[color:var(--muted)] hover:bg-[var(--paper-2)] active:scale-90 motion-tap"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

export default function GrillePays({
  countries = [],
  requete = '',
  onSelectCountry,
  onCountryAdded,
  variante = 'grande',
  idGrille,
  idAjout,
}) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const filtres = filtrerPays(countries, requete);
  const compacte = variante === 'compacte';

  const confirmerAjout = async (payload) => {
    const cree = await api.createCountry(payload);
    onCountryAdded?.(cree);
    setAjoutOuvert(false);
    addToast(t.addCountry.successToast(cree.name), 'success', 3000);
  };

  const taille = compacte ? 'h-10 w-10 sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]' : 'h-16 w-16 sm:h-20 sm:w-20';

  return (
    <>
      {filtres.length > 0 ? (
        <div
          id={idGrille}
          className={`grid gap-3 sm:gap-4 motion-stagger ${
            compacte ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {filtres.map((pays, index) => (
            <button
              key={pays.id}
              type="button"
              style={{ '--i': index }}
              onClick={() => onSelectCountry(pays)}
              aria-label={t.home.enterAria(pays.name)}
              data-variante={variante}
              className="jr-tuile focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
            >
              <span className="jr-tuile-drapeau">
                <CountryAvatar country={pays} ring className={taille} />
              </span>
              <span className={`font-extrabold text-[color:var(--ink)] leading-tight break-words ${compacte ? 'jr-tuile-nom text-base' : 'block w-full text-base sm:text-lg'}`}>
                {pays.name}
              </span>
              {compacte ? (
                <span className="jr-tuile-fleche" aria-hidden="true">
                  <ChevronRight size={16} strokeWidth={3} />
                </span>
              ) : (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                    {t.home.countryRole}
                  </span>
                  <span className="jr-tuile-entrer">
                    {t.home.enter}
                    <ChevronRight size={15} />
                  </span>
                </>
              )}
            </button>
          ))}

          <button
            id={idAjout}
            type="button"
            style={{ '--i': filtres.length }}
            onClick={() => setAjoutOuvert(true)}
            aria-label={t.home.addCountryAria}
            data-variante={variante}
            className="jr-tuile jr-tuile-ajout focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--cta-orange)]/40"
          >
            <span className={`${taille} rounded-full flex items-center justify-center bg-[var(--cta-orange)] text-white shadow-md`}>
              <Plus size={compacte ? 24 : 32} />
            </span>
            <span className={`font-extrabold leading-tight ${compacte ? 'jr-tuile-nom text-base' : 'text-base sm:text-lg'}`}>
              {t.home.addCountry}
            </span>
          </button>
        </div>
      ) : (
        <div className="p-8 text-center bg-[var(--paper)] rounded-3xl border-2 border-dashed border-[var(--border)]">
          <p className="text-base font-semibold text-[color:var(--ink)]">{t.home.noMatch(requete)}</p>
          <button
            type="button"
            onClick={() => setAjoutOuvert(true)}
            aria-label={t.home.addCountryAria}
            className="mt-4 inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-[var(--cta-orange)] text-white font-extrabold shadow-md active:scale-95 motion-tap"
          >
            <Plus size={20} />
            <span>{t.home.addThis}</span>
          </button>
        </div>
      )}

      <AddCountryDialog
        isOpen={ajoutOuvert}
        onCancel={() => setAjoutOuvert(false)}
        onConfirm={confirmerAjout}
      />
    </>
  );
}
