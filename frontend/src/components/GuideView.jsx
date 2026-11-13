import { useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * « Comment ça marche » : le guide en images de chaque espace.
 *
 * LE BESOIN : la visite guidée pointait des boutons qui n'existaient plus, et
 * ne s'adressait qu'à l'équipe montage. Le guide montre l'application telle
 * qu'elle est, en vraies captures, étape par étape — pour un correspondant
 * qui découvre l'outil, ou un nouveau monteur.
 *
 * Les images sont dans `public/guide/` et se refont d'une commande
 * (`scripts/captures-guide.mjs`) quand l'interface change : le guide ne
 * vieillit pas en silence. Le test `guide.test.jsx` vérifie que chaque étape
 * a son image.
 *
 * Chaque capture apparaît en fondu une fois chargée : jamais un cadre vide
 * qui saute, puisque sa place est réservée (largeur et hauteur connues).
 */

/** Les étapes de chaque espace, et la capture qui les montre. */
export const ETAPES_GUIDE = Object.freeze({
  reporter: [
    { cle: 'pays', image: 'journaliste-accueil.jpg', largeur: 780, hauteur: 1200 },
    { cle: 'envoi', image: 'journaliste-envoi.jpg', largeur: 780, hauteur: 1200 },
    { cle: 'suivi', image: 'journaliste-suivi.jpg', largeur: 780, hauteur: 560 },
    { cle: 'voixoff', image: 'journaliste-voixoff.jpg', largeur: 780, hauteur: 1200 },
    { cle: 'jt', image: 'journaliste-jt.jpg', largeur: 780, hauteur: 1200 },
  ],
  editor: [
    { cle: 'revue', image: 'montage-revue.jpg', largeur: 1440, hauteur: 900 },
    { cle: 'unClic', image: 'montage-jt-un-clic.jpg', largeur: 1440, hauteur: 900 },
    { cle: 'publier', image: 'montage-livraison.jpg', largeur: 1440, hauteur: 900 },
    { cle: 'stats', image: 'montage-stats.jpg', largeur: 1440, hauteur: 900 },
  ],
});

function Capture({ src, alt, largeur, hauteur }) {
  const [chargee, setChargee] = useState(false);
  return (
    <img
      src={`/guide/${src}`}
      alt={alt}
      width={largeur}
      height={hauteur}
      loading="lazy"
      decoding="async"
      onLoad={() => setChargee(true)}
      // Une image manquante montre au moins son texte de remplacement.
      onError={() => setChargee(true)}
      data-chargee={chargee || undefined}
      className="guide-capture block h-auto w-full rounded-2xl border border-[var(--border)] bg-[var(--paper-2)]"
    />
  );
}

export default function GuideView({ workspace = 'reporter', onBack }) {
  const { t } = useI18n();
  const g = t.guide;
  const espace = workspace === 'editor' ? 'editor' : 'reporter';
  const etapes = ETAPES_GUIDE[espace];
  const textes = g[espace];
  const telephone = espace === 'reporter';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-6">
      {onBack && (
        <button type="button" onClick={onBack} className="jr-bouton jr-bouton-contour !min-h-[44px] px-4 text-sm">
          <ArrowLeft size={16} aria-hidden="true" /> {g.retour}
        </button>
      )}
      <header className="jr-ciel flex items-start gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-v-accent/10 text-[color:var(--accent-deep)] flex items-center justify-center">
          <BookOpen size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--ink)] leading-tight">{g.titre}</h1>
          <p className="mt-1 text-sm sm:text-base text-[color:var(--muted)] max-w-2xl">{textes.intro}</p>
        </div>
      </header>

      <ol className="space-y-5">
        {etapes.map((etape, i) => {
          const texte = textes.etapes[etape.cle];
          return (
            <li
              key={etape.cle}
              className={`guide-etape motion-rise grid gap-5 rounded-3xl border border-[var(--border)] bg-[var(--paper)] p-4 sm:p-6 ${telephone ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center' : ''}`}
              style={{ '--i': i, animationDelay: `${Math.min(i, 6) * 60}ms` }}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-v-accent/10 text-sm font-extrabold tabular-nums text-[color:var(--accent-deep)]">{i + 1}</span>
                  <span className="text-lg sm:text-xl font-extrabold text-[color:var(--ink)] leading-snug">{texte.titre}</span>
                </p>
                <ul className="mt-3 space-y-1.5 pl-11 text-sm sm:text-base leading-relaxed text-[color:var(--ink)]">
                  {texte.points.map((point) => <li key={point} className="list-disc">{point}</li>)}
                </ul>
              </div>
              <figure className={telephone ? 'mx-auto w-full max-w-[18rem]' : ''}>
                <Capture src={etape.image} alt={texte.alt} largeur={etape.largeur} hauteur={etape.hauteur} />
              </figure>
            </li>
          );
        })}
      </ol>

      <p className="text-center text-sm text-[color:var(--muted)]">{textes.fin}</p>
    </div>
  );
}
