import React, { useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, Download, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

/**
 * L'état du rendu, posé au-dessus du lecteur du studio.
 *
 * Les panneaux de progression, de résultat et de téléchargement ne vivaient
 * que dans la branche « chutiers » du tableau de bord. Depuis le studio, on
 * cliquait sur « Générer le master » et il ne se passait visiblement rien :
 * ni pourcentage, ni durée, ni lien — seulement un bouton grisé. Il fallait
 * changer d'onglet pour découvrir que le rendu tournait, ou qu'il était fini.
 *
 * Volontairement compact : c'est une incrustation sur l'image, pas un écran.
 * Le panneau détaillé des chutiers reste la vue complète, avec le lecteur du
 * master assemblé.
 */

/**
 * Le libellé d'une phase d'assemblage.
 *
 * Le dictionnaire est passé en argument plutôt que lu par un hook : cette
 * fonction est appelée depuis le rendu mais reste une fonction pure, et c'est
 * ce qui la rend testable sans monter de composant.
 */
export function libellePhase(phase, t) {
  const dit = t.studio.panneaux;
  return {
    downloading: dit.exportRecuperation,
    encoding: dit.exportEncodage,
    uploading: dit.exportFinalisation,
    done: dit.exportTermine,
  }[phase] || dit.exportPreparation;
}

export default function ExportStatus({
  enCours,
  progression = 0,
  phase = '',
  secondes = 0,
  erreur = null,
  urlVideo = null,
  semaine = '',
  onReessayer,
}) {
  const { t } = useI18n();
  // Repliable : posée en bas du lecteur, la bannière couvrait ses commandes
  // (lecture, barre de temps) pendant tout le rendu.
  const [replie, setReplie] = useState(false);
  // Rien à dire tant que personne n'a lancé de rendu.
  if (!enCours && !erreur && !urlVideo) return null;

  if (replie) {
    const pourcentReplie = Math.round(progression);
    return (
      <button
        type="button"
        onClick={() => setReplie(false)}
        aria-expanded="false"
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-[var(--editor-accent-strong)] bg-[oklch(0.16_0.02_245/0.94)] px-3 py-1.5 text-xs font-semibold text-[color:var(--editor-text)]"
      >
        {enCours ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : erreur ? <AlertCircle size={14} aria-hidden="true" /> : <CheckCircle size={14} aria-hidden="true" />}
        {enCours ? `${pourcentReplie} %` : erreur ? t.studio.panneaux.exportEchec : t.studio.panneaux.exportPret}
      </button>
    );
  }

  const boutonReplier = (
    <button
      type="button"
      onClick={() => setReplie(true)}
      aria-label={t.studio.panneaux.exportReplier}
      title={t.studio.panneaux.exportReplier}
      className="shrink-0 rounded-lg p-1.5 text-[color:var(--editor-muted)] hover:bg-[var(--editor-panel-raised)]"
    >
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );

  const cadre = 'absolute inset-x-4 bottom-4 z-20 rounded-2xl border px-4 py-3 '
    + 'bg-[oklch(0.16_0.02_245/0.94)] backdrop-blur-sm shadow-[0_12px_32px_-12px_oklch(0.05_0.02_245/0.8)]';

  if (erreur && !enCours) {
    return (
      <div className={`${cadre} border-[var(--editor-danger)]`} role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-[var(--editor-danger)]" size={20} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--editor-text)]">{t.studio.panneaux.exportEchec}</p>
            {/* En entier : la raison dit quel plan ou quel passage corriger. */}
            <p className="text-xs leading-snug text-[color:var(--editor-muted)]">{erreur}</p>
          </div>
          {onReessayer && (
            <button type="button" onClick={onReessayer} className="btn btn-primary shrink-0 px-3 py-1.5 text-xs">
              {t.studio.panneaux.exportReessayer}
            </button>
          )}
          {boutonReplier}
        </div>
      </div>
    );
  }

  if (!enCours && urlVideo) {
    return (
      <div className={`${cadre} border-[var(--editor-accent-strong)]`}>
        <div className="flex items-center gap-3">
          <CheckCircle className="shrink-0 text-[var(--action)]" size={20} />
          <p className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--editor-text)]">
            {t.studio.panneaux.exportPret}
          </p>
          <a
            href={urlVideo}
            download={`Assemblage_JT_${semaine}.mp4`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs"
          >
            <Download size={15} /> {t.studio.panneaux.exportTelecharger}
          </a>
          {boutonReplier}
        </div>
      </div>
    );
  }

  const pourcent = Math.round(progression);
  const minutes = Math.floor(secondes / 60);
  const reste = String(secondes % 60).padStart(2, '0');

  return (
    <div
      className={`${cadre} border-[var(--editor-accent-strong)]`}
      role="status"
      aria-live="polite"
      aria-label={`Assemblage du master : ${libellePhase(phase, t)}, ${pourcent} %`}
    >
      <div className="flex items-center gap-3">
        <Loader2 className="shrink-0 animate-spin text-[var(--editor-accent)]" size={20} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-xs font-semibold text-[color:var(--editor-text)]">
              {libellePhase(phase, t)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-[color:var(--editor-muted)]">
              {minutes}:{reste}
            </span>
          </div>
          {/* scaleX plutôt qu'une largeur animée : pas de recalcul de mise en
              page à chaque image de progression. */}
          <div className="h-1 overflow-hidden rounded-full bg-[var(--editor-border)]">
            <div
              className="motion-gauge h-full rounded-full bg-[var(--editor-accent-strong)]"
              style={{ transform: `scaleX(${Math.max(3, pourcent) / 100})` }}
            />
          </div>
        </div>
        <span className="shrink-0 font-mono text-base font-bold tabular-nums text-[color:var(--editor-accent)]">
          {pourcent} %
        </span>
        {boutonReplier}
      </div>
      <p className="mt-1.5 text-[11px] text-[color:var(--editor-muted)]">
        {t.studio.panneaux.exportContinue}
      </p>
    </div>
  );
}
