/**
 * Pastille de pays pour le champ téléphone.
 *
 * `react-phone-number-input` affiche par défaut un drapeau chargé depuis un
 * service externe : une requête de plus sur des connexions déjà fragiles, et
 * un carré d'image cassée quand elle échoue. Le code pays en toutes lettres
 * est local, instantané et plus lisible qu'un drapeau de 20 px.
 */
export default function PhoneCountryBadge({ country, countryName }) {
  return (
    <span
      title={countryName}
      aria-hidden="true"
      className="inline-flex h-6 min-w-[30px] items-center justify-center rounded-md bg-[var(--accent)]/10 px-1.5 text-[11px] font-bold tracking-wide text-[color:var(--accent-deep)]"
    >
      {country || '??'}
    </span>
  );
}
