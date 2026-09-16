import React from 'react';
import { Captions, Layers, Pencil, Scissors } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { getClipRange } from './timelineModel.js';

/**
 * L'inspecteur au repos, quand aucun panneau n'est ouvert.
 *
 * La sélection vit dans la timeline, et l'inspecteur ne la voyait pas : un clip
 * sélectionné, surligné, avec sa barre d'outils affichée, laissait à droite
 * « Aucun clip sélectionné ». Le monteur lisait deux vérités contradictoires.
 * L'inspecteur montre maintenant le clip et ouvre ses réglages.
 */

/** 83.4 -> « 1:23.4 » : assez précis pour un rognage, lisible d'un coup d'œil. */
export function dureeLisible(secondes) {
  // Arrondi au dixième AVANT de séparer les minutes : sinon 59,96 s donnait
  // « 0:60.0 ».
  const dixiemes = Math.round(Math.max(0, Number(secondes) || 0) * 10);
  const minutes = Math.floor(dixiemes / 600);
  const reste = ((dixiemes - minutes * 600) / 10).toFixed(1).padStart(4, '0');
  return `${minutes}:${reste}`;
}

function Bouton({ icone, libelle, compte = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--editor-border)] px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--editor-text)] hover:border-[var(--editor-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
    >
      {icone}
      <span className="min-w-0 flex-1 truncate">{libelle}</span>
      {compte > 0 && (
        <span className="shrink-0 rounded-full bg-[var(--editor-border)] px-2 py-0.5 font-mono text-[11px] tabular-nums">{compte}</span>
      )}
    </button>
  );
}

export default function InspecteurClip({ clip, onRogner, onHabiller, onSousTitrer }) {
  const { t } = useI18n();
  const dit = t.studio.timeline;

  const entete = (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
      <Scissors size={16} className="text-[var(--accent)]" />
      <p className="text-sm font-semibold text-[color:var(--ink)]">{dit.inspecteur}</p>
    </div>
  );

  if (!clip) {
    return (
      <div className="flex min-h-full flex-1 flex-col text-[color:var(--muted)]">
        {entete}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Scissors size={26} className="opacity-35" />
          <div>
            <p className="mb-1 text-sm font-semibold text-[color:var(--ink)]">{dit.inspecteurVide}</p>
            <p className="mx-auto max-w-[34ch] text-xs leading-5">{dit.inspecteurVideAide}</p>
          </div>
        </div>
      </div>
    );
  }

  const plage = getClipRange(clip);
  const nom = clip.name || clip.filename || dit.clipSelectionne;

  return (
    <div className="flex min-h-full flex-1 flex-col text-[color:var(--muted)]" aria-label={`${dit.inspecteur} : ${nom}`}>
      {entete}
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider">{dit.clipSelectionne}</p>
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]" title={nom}>{nom}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
          <div>
            <dt className="font-sans text-[11px]">IN</dt>
            <dd className="text-[color:var(--ink)]">{dureeLisible(plage.inPoint)}</dd>
          </div>
          <div>
            <dt className="font-sans text-[11px]">OUT</dt>
            <dd className="text-[color:var(--ink)]">{dureeLisible(plage.outPoint)}</dd>
          </div>
          <div>
            <dt className="font-sans text-[11px]">{dit.inspecteurDuree}</dt>
            <dd className="text-[color:var(--ink)]">{dureeLisible(plage.durationSec)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <Bouton icone={<Pencil size={15} />} libelle={dit.rognagePrecis} onClick={() => onRogner?.(clip)} />
          <Bouton icone={<Layers size={15} />} libelle={dit.habillageClip} compte={clip.overlays?.length || 0} onClick={() => onHabiller?.(clip)} />
          <Bouton icone={<Captions size={15} />} libelle={dit.sousTitres} compte={clip.subtitles?.length || 0} onClick={() => onSousTitrer?.(clip)} />
        </div>
      </div>
    </div>
  );
}
