/**
 * Teintes en variable CSS, avec opacité.
 *
 * L'INCIDENT : Tailwind 3 n'écrit AUCUNE règle pour `bg-[var(--accent)]/10`
 * — il ne sait pas appliquer une opacité à une couleur qu'il ne connaît que
 * par `var(--…)`. Les 181 classes de ce type ne faisaient rien : encadrés
 * « bien reçus » sans fond vert, alertes orange sans fond, voiles des
 * fenêtres qui n'assombrissaient pas la page. Chaque variable utilisée avec
 * une opacité devient une couleur du thème (`bg-v-accent/10`), mélangée par
 * `color-mix()`. Un navigateur trop ancien pour `color-mix` ignore la
 * déclaration : on retombe sur l'état d'avant, rien de pire.
 *
 * Une classe `-[var(--x)]/NN` réapparue est refusée par le test
 * `teintes-en-variable`.
 */
/** @type {import('tailwindcss').Config} */
export default {
  // Le survol ne s'applique qu'aux appareils qui survolent vraiment : sur un
  // téléphone, toucher un bouton laissait son état « survolé » collé.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Sora"', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        'v-accent': 'color-mix(in oklab, var(--accent) calc(<alpha-value> * 100%), transparent)',
        'v-accent-deep': 'color-mix(in oklab, var(--accent-deep) calc(<alpha-value> * 100%), transparent)',
        'v-accent-soft': 'color-mix(in oklab, var(--accent-soft) calc(<alpha-value> * 100%), transparent)',
        'v-action': 'color-mix(in oklab, var(--action) calc(<alpha-value> * 100%), transparent)',
        'v-cta-orange': 'color-mix(in oklab, var(--cta-orange) calc(<alpha-value> * 100%), transparent)',
        'v-cta-red': 'color-mix(in oklab, var(--cta-red) calc(<alpha-value> * 100%), transparent)',
        'v-editor-accent': 'color-mix(in oklab, var(--editor-accent) calc(<alpha-value> * 100%), transparent)',
        'v-editor-bg': 'color-mix(in oklab, var(--editor-bg) calc(<alpha-value> * 100%), transparent)',
        'v-editor-danger': 'color-mix(in oklab, var(--editor-danger) calc(<alpha-value> * 100%), transparent)',
        'v-editor-muted': 'color-mix(in oklab, var(--editor-muted) calc(<alpha-value> * 100%), transparent)',
        'v-editor-panel': 'color-mix(in oklab, var(--editor-panel) calc(<alpha-value> * 100%), transparent)',
        'v-editor-panel-raised': 'color-mix(in oklab, var(--editor-panel-raised) calc(<alpha-value> * 100%), transparent)',
        'v-editor-text': 'color-mix(in oklab, var(--editor-text) calc(<alpha-value> * 100%), transparent)',
        'v-editor-title': 'color-mix(in oklab, var(--editor-title) calc(<alpha-value> * 100%), transparent)',
        'v-ink': 'color-mix(in oklab, var(--ink) calc(<alpha-value> * 100%), transparent)',
        'v-muted': 'color-mix(in oklab, var(--muted) calc(<alpha-value> * 100%), transparent)',
        'v-paper': 'color-mix(in oklab, var(--paper) calc(<alpha-value> * 100%), transparent)',
        'v-signal': 'color-mix(in oklab, var(--signal) calc(<alpha-value> * 100%), transparent)',
        'v-success': 'color-mix(in oklab, var(--success) calc(<alpha-value> * 100%), transparent)',
      },
    },
  },
  plugins: [],
};
