/**
 * « Rien n'est encore arrivé » : un bac de dépôt vide, un document qui y
 * descend. Tracé sur mesure, aux deux bleus du logo, pour deux raisons :
 * les catalogues d'icônes gratuits imposent une mention de crédit sur chaque
 * écran, et leurs illustrations n'auraient pas la palette de la charte.
 *
 * Les couleurs sont prises dans les variables de thème : l'illustration suit
 * la surface sur laquelle on la pose, claire ou sombre.
 */
export default function EmptyInbox({ size = 132, className = '' }) {
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
      {/* Sol : ancre l'objet, évite l'illustration qui flotte. */}
      <ellipse cx="66" cy="96" rx="44" ry="6" fill="var(--accent-soft)" opacity="0.22" />

      {/* Document en cours de dépôt. */}
      <g opacity="0.95">
        <rect x="46" y="8" width="40" height="46" rx="6" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.5" />
        <rect x="54" y="20" width="24" height="3.5" rx="1.75" fill="var(--accent-soft)" />
        <rect x="54" y="29" width="18" height="3.5" rx="1.75" fill="var(--accent-soft)" />
        <rect x="54" y="38" width="21" height="3.5" rx="1.75" fill="var(--accent-soft)" />
      </g>

      {/* Bac de dépôt. */}
      <path
        d="M18 58h26l7 12h30l7-12h26v28a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10V58Z"
        fill="var(--paper-2)"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M18 58 28 34h76l10 24" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" fill="none" opacity="0.45" />
    </svg>
  );
}
