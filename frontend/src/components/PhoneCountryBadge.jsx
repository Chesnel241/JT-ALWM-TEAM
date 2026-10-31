import { urlDrapeauIso } from '../lib/drapeaux.js';

/**
 * Pastille de pays pour le champ téléphone : le drapeau, puis le code.
 *
 * `react-phone-number-input` affiche par défaut un drapeau chargé depuis un
 * service externe : une requête de plus sur des connexions déjà fragiles, et
 * un carré d'image cassée quand elle échoue. Les drapeaux sont désormais
 * servis par l'application (`public/flags`) : on les montre, et le code pays
 * reste écrit à côté, pour les pays qui n'ont pas de drapeau local.
 */
export default function PhoneCountryBadge({ country, countryName }) {
  const drapeau = urlDrapeauIso(country);
  return (
    <span
      title={countryName}
      aria-hidden="true"
      className="inline-flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-wide text-[color:var(--accent-deep)]"
    >
      {drapeau && (
        <img src={drapeau} alt="" className="h-5 w-7 rounded-[4px] object-cover shadow-sm ring-1 ring-black/10" />
      )}
      {/* Sur un petit téléphone, le drapeau suffit : la place va au numéro. */}
      <span className={drapeau ? 'max-[420px]:hidden' : undefined}>{country || '??'}</span>
    </span>
  );
}
