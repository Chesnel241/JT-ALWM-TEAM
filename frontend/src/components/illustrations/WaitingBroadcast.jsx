/**
 * « Le JT n'est pas encore prêt » : un écran de diffusion et une horloge.
 * Même parti pris que EmptyInbox — tracé maison, palette de la charte, aucune
 * licence tierce à créditer.
 */
export default function WaitingBroadcast({ size = 132, className = '' }) {
  return (
    <svg
      width={size}
      height={(size * 108) / 132}
      viewBox="0 0 132 108"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="66" cy="97" rx="42" ry="6" fill="var(--accent-soft)" opacity="0.22" />

      {/* Écran. */}
      <rect x="14" y="14" width="104" height="66" rx="10" fill="var(--paper-2)" stroke="var(--accent)" strokeWidth="2.5" />
      <rect x="24" y="24" width="84" height="46" rx="5" fill="var(--accent)" opacity="0.1" />

      {/* Pied. */}
      <path d="M52 80v8h28v-8" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <rect x="40" y="87" width="52" height="5" rx="2.5" fill="var(--accent)" opacity="0.55" />

      {/* Lecture, en attente. */}
      <path d="M58 39.5v17l15-8.5-15-8.5Z" fill="var(--accent)" opacity="0.45" />

      {/* Horloge : c'est elle qui dit « plus tard », pas « jamais ». */}
      <circle cx="98" cy="66" r="17" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M98 57v9.5l6 4" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
