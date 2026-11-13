import { useEffect, useRef, useState } from 'react';
import { Download, ListVideo, X } from 'lucide-react';
import { API_BASE } from '../api/index.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';
import { tailleLisible } from '../lib/taille.js';
import { avanceeDansChapitre, chapitreEnCours, minutage } from '../lib/sommaire.js';

const urlDe = (filename, telecharger = false) => `${API_BASE}/uploads/${encodeURIComponent(filename)}${telecharger ? '?dl=1' : ''}`;

/** La version légère, quand elle existe. */
export const legerPret = (fichier) => fichier?.leger?.statut === 'pret' && fichier.leger.filename ? fichier.leger : null;

/**
 * Le lecteur du JT publié, avec son sommaire.
 *
 * LE BESOIN : un correspondant veut voir SON reportage sans faire défiler
 * trente minutes sur un téléphone. Chaque partie du journal est un repère :
 * on le touche, la lecture y saute. Le repère en cours est marqué, et une
 * jauge discrète dit où on en est dans la partie.
 *
 * Sur un téléphone, la version légère est lue d'abord ; on peut passer en
 * qualité TV sans perdre l'endroit où on en était.
 */
export default function LecteurJT({ fichier, debut = 0, prefererLeger = false, onFermer, onTelecharger }) {
  const { t } = useI18n();
  const l = t.jtPret.lecteur;
  const boite = usePiegeFocus(true, onFermer);
  const video = useRef(null);
  const reprise = useRef(Math.max(0, Number(debut) || 0));
  const leger = legerPret(fichier);
  const [qualite, setQualite] = useState(prefererLeger && leger ? 'leger' : 'tv');
  const [instant, setInstant] = useState(reprise.current);
  const [duree, setDuree] = useState(0);
  const chapitres = Array.isArray(fichier?.sommaire) ? fichier.sommaire : [];
  const enCours = chapitreEnCours(chapitres, instant);
  const source = qualite === 'leger' && leger ? leger.filename : fichier.filename;

  // Un saut demandé de l'extérieur (un repère touché sur la carte).
  useEffect(() => {
    reprise.current = Math.max(0, Number(debut) || 0);
    if (video.current && video.current.readyState >= 1) video.current.currentTime = reprise.current;
  }, [debut]);

  const aller = (t0) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t0;
    setInstant(t0);
    // `play()` rend une promesse, sauf sur les navigateurs anciens.
    const lecture = v.play?.();
    lecture?.catch?.(() => {});
  };

  const changerQualite = () => {
    reprise.current = video.current?.currentTime || instant;
    setQualite((q) => (q === 'leger' ? 'tv' : 'leger'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 motion-voile" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <section
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lecteur-jt-titre"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--paper)] shadow-2xl motion-boite"
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2 id="lecteur-jt-titre" className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)]">{fichier.name}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label={t.common.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="aspect-video shrink-0 bg-black">
          <video
            key={source}
            ref={video}
            src={urlDe(source)}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            onLoadedMetadata={(e) => {
              setDuree(e.currentTarget.duration || 0);
              if (reprise.current > 0) e.currentTarget.currentTime = reprise.current;
            }}
            onTimeUpdate={(e) => setInstant(e.currentTarget.currentTime)}
          />
        </div>

        {chapitres.length > 0 && (
          <nav aria-label={l.sommaire} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
            <h3 className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              <ListVideo size={14} aria-hidden="true" /> {l.sommaire}
            </h3>
            <ol className="space-y-0.5">
              {chapitres.map((c, i) => {
                const actif = i === enCours;
                return (
                  <li key={`${c.t}-${i}`}>
                    <button
                      type="button"
                      onClick={() => aller(c.t)}
                      aria-current={actif ? 'true' : undefined}
                      aria-label={l.allerA(minutage(c.t), c.titre)}
                      className={`lecteur-chapitre relative flex min-h-[44px] w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left ${actif ? 'bg-v-accent/10' : 'hover:bg-[var(--paper-2)]'}`}
                    >
                      {/* La jauge de la partie en cours : mise à l'échelle,
                          jamais une largeur animée. */}
                      {actif && (
                        <span
                          aria-hidden="true"
                          className="lecteur-jauge absolute inset-y-0 left-0 w-full bg-v-accent/10"
                          style={{ transform: `scaleX(${avanceeDansChapitre(chapitres, i, instant, duree)})` }}
                        />
                      )}
                      <span aria-hidden="true" className={`lecteur-repere relative h-6 w-1 shrink-0 rounded-full ${actif ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                      <span className="relative w-14 shrink-0 font-mono text-xs tabular-nums text-[color:var(--muted)]">{minutage(c.t)}</span>
                      <span className={`relative min-w-0 flex-1 text-sm leading-snug ${actif ? 'font-bold text-[color:var(--ink)]' : 'text-[color:var(--ink)]'}`}>{c.titre}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--paper-2)] px-4 py-3">
          {leger ? (
            <button type="button" onClick={changerQualite} className="min-h-[44px] rounded-xl px-2 text-xs font-bold text-[color:var(--accent-deep)] underline-offset-2 hover:underline">
              {qualite === 'leger' ? l.passerTV : l.passerLeger}
            </button>
          ) : <span />}
          <a
            href={urlDe(source, true)}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTelecharger?.(fichier)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--action)] px-4 text-xs font-bold text-white shadow-sm"
          >
            <Download size={14} aria-hidden="true" />
            {l.telecharger(tailleLisible(qualite === 'leger' && leger ? leger.size : fichier.size))}
          </a>
        </footer>
      </section>
    </div>
  );
}
