/**
 * Écran vide : illustration, phrase qui dit ce qui se passe, phrase qui dit
 * quoi faire, et au besoin un bouton.
 *
 * Les écrans vides de la plateforme montraient une icône de 24 à 32 px en gris
 * clair. Sur un téléphone, cela se lit comme une erreur de chargement plutôt
 * que comme « c'est normal, il n'y a rien pour l'instant » — d'autant que la
 * même icône grise sert de bouton ailleurs dans l'application.
 */
export default function EmptyState({
  illustration = null,
  title,
  hint,
  action = null,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-10'} px-4 ${className}`}
    >
      {illustration && (
        <div className={`motion-rise ${compact ? 'mb-3' : 'mb-4'}`} aria-hidden="true">
          {illustration}
        </div>
      )}
      <p className="font-bold text-[color:var(--ink)] text-sm sm:text-base leading-snug max-w-sm">
        {title}
      </p>
      {hint && (
        <p className="mt-2 text-sm text-[color:var(--muted)] leading-relaxed max-w-sm">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
