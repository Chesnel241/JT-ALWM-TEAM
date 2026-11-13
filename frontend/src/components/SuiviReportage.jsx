import { AlertTriangle, Check, Play } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatAbsolute } from '../lib/dates.js';
import { minutage } from '../lib/sommaire.js';

/**
 * Où en est mon reportage : reçu, vu par la rédaction, retenu, diffusé.
 *
 * LE BESOIN : une fois ses fichiers envoyés, le correspondant ne savait plus
 * rien jusqu'à la publication du JT — et alors, il parcourait trente minutes
 * pour savoir si son reportage y était. Quatre étapes reliées, la dernière
 * atteinte dite en une phrase ; et, une fois diffusé, la minute du JT où il
 * passe, à regarder d'un geste.
 *
 * Le suivi vient du serveur (`sujet.suivi`, services/suiviSujet.js) : il se
 * déduit de ce que fait la rédaction, sans rien lui demander de plus.
 *
 * Le trait se remplit jusqu'à l'étape atteinte, et les étapes franchies
 * s'allument l'une après l'autre : un mouvement court, qui dit le chemin
 * parcouru plutôt que de décorer.
 */

/** Le rang de chaque étape sur les quatre jalons. */
const RANG = { attendu: -1, recu: 0, vu: 1, valide: 1, aCorriger: 1, retenu: 2, diffuse: 3 };

export default function SuiviReportage({ suivi, onRegarder }) {
  const { t, lang } = useI18n();
  const s = t.suivi;
  if (!suivi || suivi.etape === 'attendu') return null;
  const rang = RANG[suivi.etape] ?? 0;
  const jalons = [
    { cle: 'recu', libelle: s.recu },
    {
      cle: 'vu',
      libelle: suivi.etape === 'aCorriger' ? s.aCorriger : suivi.etape === 'valide' || rang > 1 ? s.valide : s.vu,
      alerte: suivi.etape === 'aCorriger',
    },
    { cle: 'retenu', libelle: s.retenu },
    { cle: 'diffuse', libelle: s.diffuse },
  ];
  // Plutôt valide que simplement vu, une fois retenu : un reportage retenu a
  // été regardé, même si personne n'a cliqué sur « Valider ».
  const quand = (iso) => (iso ? formatAbsolute(iso, lang) : '');
  const detail = {
    recu: s.detailRecu(quand(suivi.recuLe)),
    vu: s.detailVu(quand(suivi.vuLe)),
    valide: s.detailValide,
    aCorriger: s.detailACorriger,
    retenu: s.detailRetenu,
    diffuse: suivi.diffusion?.t != null ? s.detailDiffuseA(minutage(suivi.diffusion.t)) : s.detailDiffuse,
  }[suivi.etape];

  return (
    <section className="jr-suivi" aria-label={s.titre} data-etape={suivi.etape}>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{s.titre}</h4>
      {/* Le trait (et son remplissage) est dessiné par la liste elle-même,
          en pseudo-éléments : une liste ne contient que ses étapes. */}
      <ol className="jr-suivi-jalons" style={{ '--avance': Math.max(0, rang) / 3 }}>
        {jalons.map((j, i) => {
          const atteint = i <= rang;
          const courant = i === rang;
          return (
            <li
              key={j.cle}
              className="jr-suivi-jalon"
              data-atteint={atteint || undefined}
              data-courant={courant || undefined}
              data-alerte={(j.alerte && courant) || undefined}
              style={{ '--i': i }}
              aria-current={courant ? 'step' : undefined}
            >
              <span className="jr-suivi-noeud" aria-hidden="true">
                {j.alerte && courant ? <AlertTriangle size={11} strokeWidth={3} /> : atteint ? <Check size={11} strokeWidth={3.5} /> : null}
              </span>
              <span className="jr-suivi-libelle">
                {j.libelle}
                <span className="sr-only">{atteint ? ` — ${s.fait}` : ` — ${s.aVenir}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`min-w-0 text-sm leading-snug ${suivi.etape === 'aCorriger' ? 'font-semibold text-[color:var(--cta-orange-deep)]' : 'text-[color:var(--ink)]'}`}>{detail}</p>
        {suivi.etape === 'diffuse' && suivi.diffusion && onRegarder && (
          <button
            type="button"
            onClick={() => onRegarder(suivi.diffusion)}
            className="jr-bouton jr-bouton-bleu !min-h-[44px] shrink-0 px-4 text-sm"
          >
            <Play size={15} className="fill-current" aria-hidden="true" />
            {s.regarder}
          </button>
        )}
      </div>
    </section>
  );
}
