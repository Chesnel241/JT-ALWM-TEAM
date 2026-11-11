import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowUp, Captions, Check, ChevronDown, ChevronRight, Copy, Film, GripVertical,
  LayoutList, Newspaper, Plus, Redo2, Rows3, Scissors, Search, Trash2, Type, Undo2, Video,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { API_BASE } from '../../api/index.js';
import CountryAvatar from '../CountryAvatar.jsx';
import {
  deplacer, deroule, dupliquer, dureeParlee, instant, planALInstant, rangerRushes, retirer,
} from './conducteur.js';

/**
 * Le studio simple : les rushes à gauche, l'image au centre, le déroulé du JT
 * à droite. Voir `conducteur.js` pour le constat qui a mené à cette refonte.
 */

// Les enchaînements qu'on emploie vraiment dans un JT. La liste complète
// (trente-quatre effets) reste dans la vue détaillée.
const ENCHAINEMENTS = ['none', 'fade', 'fadeblack', 'dissolve', 'slideleft', 'wipeleft'];

/** Une vignette qui ne charge sa vidéo qu'une fois à l'écran. */
function Vignette({ filename, instantSec = 0.1, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return undefined;
    const noeud = ref.current;
    if (!noeud) return undefined;
    if (typeof IntersectionObserver !== 'function') { setVisible(true); return undefined; }
    const observateur = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) setVisible(true);
    }, { rootMargin: '300px' });
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, [visible]);
  const externe = filename?.startsWith('http') || filename?.startsWith('blob:');
  const src = externe ? filename : `${API_BASE}/uploads/${encodeURIComponent(filename || '')}`;
  return (
    <span ref={ref} className={`relative block shrink-0 overflow-hidden rounded-md bg-[var(--editor-bg)] ${className}`}>
      <span className="absolute inset-0 flex items-center justify-center text-[color:var(--editor-muted)] opacity-40" aria-hidden="true">
        <Video size={18} />
      </span>
      {visible && filename && (
        <video
          src={`${src}#t=${Math.max(0.1, Number(instantSec) || 0.1).toFixed(2)}`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden="true"
          className="relative h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </span>
  );
}

const boutonBarre = 'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--editor-border)] px-3 text-sm font-semibold text-[color:var(--editor-text)] '
  + 'hover:border-[var(--editor-accent)] hover:bg-[var(--editor-panel-raised)] disabled:cursor-not-allowed disabled:opacity-35 '
  + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]';

/** La barre du haut : où l'on en est, et le bouton qui compte. */
export function BarreStudio({
  semaine, nombrePlans, dureeTotale, etat, detaille, onBasculer,
  onAnnuler, onRetablir, peutAnnuler, peutRetablir, onHabillage, habillageActif,
  onGenerer, enCours, presence = 0,
}) {
  const { t } = useI18n();
  const d = t.studio.deroule;
  const etatTexte = { saving: d.etatEnCours, error: d.etatErreur, loading: d.etatChargement }[etat] || d.etatEnregistre;
  const etatCouleur = etat === 'error' ? 'bg-[var(--editor-danger)]' : etat === 'saving' || etat === 'loading' ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex min-h-[60px] shrink-0 items-center gap-3 border-b border-[var(--editor-border)] bg-[var(--editor-panel)] px-4 py-2" role="toolbar" aria-label={d.barre}>
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-[color:var(--editor-text)]">{d.titre(semaine)}</p>
        <p className="flex items-center gap-2 text-xs text-[color:var(--editor-muted)]">
          <span>{d.resume(nombrePlans, dureeParlee(dureeTotale))}</span>
          <span className="inline-flex items-center gap-1.5" role="status">
            <span className={`h-2 w-2 rounded-full ${etatCouleur}`} aria-hidden="true" />
            {etatTexte}
          </span>
          {presence > 1 && <span>· {d.presence(presence)}</span>}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!detaille && (
          <>
            <button type="button" className={boutonBarre} onClick={onAnnuler} disabled={!peutAnnuler} title={`${d.annuler} · Ctrl+Z`}>
              <Undo2 size={17} aria-hidden="true" /><span className="hidden min-[1500px]:inline">{d.annuler}</span>
              <span className="sr-only min-[1500px]:hidden">{d.annuler}</span>
            </button>
            <button type="button" className={boutonBarre} onClick={onRetablir} disabled={!peutRetablir} title={d.retablir} aria-label={d.retablir}>
              <Redo2 size={17} aria-hidden="true" />
            </button>
            <button type="button" className={`${boutonBarre} ${habillageActif ? 'border-[var(--editor-accent)]' : ''}`} onClick={onHabillage}>
              <Newspaper size={17} aria-hidden="true" />{d.habillage}
            </button>
          </>
        )}
        <button type="button" className={boutonBarre} onClick={onBasculer} aria-pressed={detaille} title={detaille ? d.vueSimpleAide : d.vueDetailleeAide}>
          {detaille ? <LayoutList size={17} aria-hidden="true" /> : <Rows3 size={17} aria-hidden="true" />}
          {detaille ? d.vueSimple : d.vueDetaillee}
        </button>
        {!detaille && (
          <button
            type="button"
            data-generer-master
            onClick={onGenerer}
            disabled={nombrePlans === 0 || enCours}
            aria-busy={enCours}
            className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--editor-accent-strong)] px-5 text-sm font-bold text-[color:var(--editor-bg)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-text)]"
          >
            <Film size={18} aria-hidden="true" />
            {enCours ? d.generationEnCours : d.generer}
          </button>
        )}
      </div>
    </div>
  );
}

/** Les rushes de la semaine, à portée de main dans le studio. */
export function RushesStudio({ videos, clips, countries, onAjouter }) {
  const { t } = useI18n();
  const d = t.studio.deroule;
  const [recherche, setRecherche] = useState('');
  const [replies, setReplies] = useState(() => new Set());
  const groupes = useMemo(() => rangerRushes(videos, clips, {
    nomPays: (id) => countries.find((c) => c.id === id)?.name || id,
    recherche,
  }), [videos, clips, countries, recherche]);
  const total = groupes.reduce((n, g) => n + g.nombre, 0);
  const basculer = (id) => setReplies((avant) => {
    const suite = new Set(avant);
    if (suite.has(id)) suite.delete(id); else suite.add(id);
    return suite;
  });

  return (
    <aside className="flex w-[clamp(260px,22vw,340px)] shrink-0 flex-col border-r border-[var(--editor-border)] bg-[var(--editor-panel)]" aria-label={d.rushes}>
      <div className="shrink-0 border-b border-[var(--editor-border)] p-3">
        <h3 className="mb-2 flex items-baseline justify-between text-sm font-bold text-[color:var(--editor-text)]">
          {d.rushes}
          <span className="text-xs font-medium text-[color:var(--editor-muted)]">{d.rushesNombre(total)}</span>
        </h3>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-bg)] px-3 focus-within:border-[var(--editor-accent)]">
          <Search size={16} className="shrink-0 text-[color:var(--editor-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={d.chercher}
            aria-label={d.chercher}
            className="min-w-0 flex-1 bg-transparent text-base text-[color:var(--editor-text)] placeholder:text-[color:var(--editor-muted)] focus:outline-none"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groupes.length === 0 && (
          <p className="px-3 py-8 text-center text-sm leading-6 text-[color:var(--editor-muted)]">
            {recherche ? d.rushesIntrouvables : d.rushesVides}
          </p>
        )}
        {groupes.map((groupe) => {
          const ferme = replies.has(groupe.id) && !recherche;
          return (
            <section key={groupe.id} className="mb-2">
              <button
                type="button"
                onClick={() => basculer(groupe.id)}
                aria-expanded={!ferme}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold text-[color:var(--editor-text)] hover:bg-[var(--editor-panel-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
              >
                {ferme ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                <CountryAvatar country={countries.find((c) => c.id === groupe.id) || { id: groupe.id, name: groupe.nom }} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate">{groupe.nom}</span>
                <span className="text-xs font-medium text-[color:var(--editor-muted)]">{groupe.nombre}</span>
              </button>
              {!ferme && groupe.reportages.map((reportage) => (
                <div key={reportage.titre || '—'} className="mb-1 ml-2 border-l border-[var(--editor-border)] pl-2">
                  {reportage.titre && (
                    <p className="truncate px-1 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--editor-muted)]">{reportage.titre}</p>
                  )}
                  <ul className="space-y-1">
                    {reportage.rushes.map((rush) => (
                      <li key={rush.id || rush.filename}>
                        <button
                          type="button"
                          onClick={() => onAjouter(rush)}
                          title={d.ajouterAide}
                          className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left hover:border-[var(--editor-accent)] hover:bg-[var(--editor-panel-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
                        >
                          <Vignette filename={rush.filename} className="h-[45px] w-20" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[color:var(--editor-text)]">{rush.name}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--editor-muted)]">
                              {rush.emplois > 0 && (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-400">
                                  <Check size={12} aria-hidden="true" />{d.dejaDansLeJT(rush.emplois)}
                                </span>
                              )}
                              {rush.emplois === 0 && rush.status === 'approved' && <span>{d.valide}</span>}
                              {rush.emplois === 0 && rush.status !== 'approved' && <span>{d.aRevoir}</span>}
                            </span>
                          </span>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--editor-border)] text-[color:var(--editor-accent)] group-hover:border-[var(--editor-accent)] group-hover:bg-[var(--editor-accent-strong)] group-hover:text-[color:var(--editor-bg)]" aria-hidden="true">
                            <Plus size={17} />
                          </span>
                          <span className="sr-only">{d.ajouter}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

const boutonPlan = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--editor-border)] px-2.5 text-xs font-semibold text-[color:var(--editor-text)] '
  + 'hover:border-[var(--editor-accent)] hover:bg-[var(--editor-bg)] disabled:cursor-not-allowed disabled:opacity-35 '
  + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]';

function Plan({
  plan, dernier, premier, choisi, aLEcran, nomPays, onChoisir, onRaccourcir, onNom, onSousTitres,
  onEnchainement, onMonter, onDescendre, onDupliquer, onRetirer,
}) {
  const { t } = useI18n();
  const d = t.studio.deroule;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plan.id });
  const { clip } = plan;
  const nom = clip.name || clip.filename || d.sansNom;
  const origine = [nomPays(clip.countryId), clip.reportage].filter(Boolean).join(' · ');
  const enchainement = clip.transition?.type || 'none';
  const options = ENCHAINEMENTS.includes(enchainement) ? ENCHAINEMENTS : [...ENCHAINEMENTS, enchainement];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border ${choisi ? 'border-[var(--editor-accent)] bg-[var(--editor-panel-raised)]' : 'border-[var(--editor-border)] bg-[var(--editor-panel)]'} ${isDragging ? 'relative z-10 opacity-80 shadow-lg' : ''}`}
      data-plan={plan.rang}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={d.deplacer(plan.rang, nom)}
          title={d.deplacerAide}
          className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-xl text-[color:var(--editor-muted)] hover:bg-[var(--editor-bg)] hover:text-[color:var(--editor-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] active:cursor-grabbing"
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onChoisir}
          aria-pressed={choisi}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-r-xl py-2 pr-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--editor-accent)]"
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${aLEcran ? 'bg-[var(--editor-accent-strong)] text-[color:var(--editor-bg)]' : 'bg-[var(--editor-bg)] text-[color:var(--editor-muted)]'}`}>
            {plan.rang}
          </span>
          <Vignette filename={clip.filename} instantSec={(Number(clip.inPoint) || 0) + 0.3} className="h-[54px] w-24" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[color:var(--editor-text)]">{nom}</span>
            {origine && <span className="block truncate text-xs text-[color:var(--editor-muted)]">{origine}</span>}
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[color:var(--editor-muted)]">
              <span className="font-mono tabular-nums">{d.aPartirDe(instant(plan.debut))}</span>
              {(clip.overlays?.length || 0) > 0 && <span className="inline-flex items-center gap-1 text-[color:var(--editor-accent)]"><Type size={11} aria-hidden="true" />{d.avecNom}</span>}
              {(clip.subtitles?.length || 0) > 0 && <span className="inline-flex items-center gap-1 text-[color:var(--editor-accent)]"><Captions size={11} aria-hidden="true" />{d.avecSousTitres}</span>}
            </span>
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[color:var(--editor-text)]">{dureeParlee(plan.duree)}</span>
        </button>
      </div>

      {choisi && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--editor-border)] px-3 py-2">
          <button type="button" className={boutonPlan} onClick={onRaccourcir}><Scissors size={14} aria-hidden="true" />{d.raccourcir}</button>
          <button type="button" className={boutonPlan} onClick={onNom}><Type size={14} aria-hidden="true" />{d.nomALEcran}</button>
          <button type="button" className={boutonPlan} onClick={onSousTitres}><Captions size={14} aria-hidden="true" />{d.sousTitres}</button>
          <span className="ml-auto flex items-center gap-1.5">
            <button type="button" className={boutonPlan} onClick={onMonter} disabled={premier} aria-label={d.monter} title={d.monter}><ArrowUp size={14} aria-hidden="true" /></button>
            <button type="button" className={boutonPlan} onClick={onDescendre} disabled={dernier} aria-label={d.descendre} title={d.descendre}><ArrowDown size={14} aria-hidden="true" /></button>
            <button type="button" className={boutonPlan} onClick={onDupliquer} aria-label={d.dupliquer} title={d.dupliquer}><Copy size={14} aria-hidden="true" /></button>
            <button type="button" className={`${boutonPlan} border-v-editor-danger/55 text-[color:var(--editor-danger)] hover:bg-v-editor-danger/15`} onClick={onRetirer}><Trash2 size={14} aria-hidden="true" />{d.retirer}</button>
          </span>
          {!dernier && (
            <label className="flex w-full items-center gap-2 pt-1 text-xs font-semibold text-[color:var(--editor-muted)]">
              {d.enchainement}
              <select
                value={enchainement}
                onChange={(e) => onEnchainement(e.target.value)}
                className="h-9 flex-1 rounded-md border border-[var(--editor-border)] bg-[var(--editor-bg)] px-2 text-base text-[color:var(--editor-text)] focus:border-[var(--editor-accent)] focus:outline-none"
              >
                {options.map((id) => <option key={id} value={id}>{t.studio.transitions[id] || id}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Le déroulé : les plans dans l'ordre de diffusion. On clique un plan pour le
 * voir, on le glisse pour le déplacer.
 */
export function Deroule({
  clips, countries, playerRef, choisiId, onChoisir, modifierMontage, nouvelId,
  onRaccourcir, onNom, onSousTitres, onAnnuler, onRetablir,
}) {
  const { t } = useI18n();
  const d = t.studio.deroule;
  const { plans, total } = useMemo(() => deroule(clips), [clips]);
  const [aLEcranId, setALEcranId] = useState(null);
  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nomPays = (id) => countries.find((c) => c.id === id)?.name || '';

  // Le plan qui passe à l'écran : le numéro s'allume pendant la lecture.
  useEffect(() => {
    const lecteur = playerRef?.current;
    if (!lecteur?.addEventListener) return undefined;
    const suivre = (e) => {
      const courant = planALInstant(plans, (e.detail?.frame ?? 0) / 30);
      setALEcranId((avant) => (courant?.id === avant ? avant : courant?.id ?? null));
    };
    lecteur.addEventListener('frameupdate', suivre);
    return () => lecteur.removeEventListener('frameupdate', suivre);
  }, [playerRef, plans]);

  const choisir = (plan) => {
    onChoisir(plan.id);
    const lecteur = playerRef?.current;
    if (lecteur?.seekTo) {
      lecteur.pause?.();
      lecteur.seekTo(Math.round(plan.debut * 30));
    }
  };
  const changer = (maj, etiquette) => modifierMontage((m) => {
    const suite = maj(m.clips);
    return suite === m.clips ? m : { ...m, clips: suite };
  }, etiquette);
  // Le clavier, pour qui monte vite : Espace lit, les flèches changent de
  // plan, Suppr retire, Ctrl+Z annule. Jamais pendant une saisie.
  const raccourcis = useRef(null);
  raccourcis.current = (event) => {
    const cible = event.target;
    if (cible instanceof Element && cible.closest('input, textarea, select, [contenteditable="true"]')) return;
    const commande = event.ctrlKey || event.metaKey;
    if (commande && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) onRetablir?.(); else onAnnuler?.();
      return;
    }
    if (commande || event.altKey) return;
    const rang = plans.findIndex((p) => p.id === choisiId);
    if (event.code === 'Space') {
      // Sur un bouton, Espace l'active déjà : on ne double pas le geste.
      if (cible instanceof Element && cible.closest('button, a')) return;
      event.preventDefault();
      const lecteur = playerRef?.current;
      if (lecteur?.isPlaying?.()) lecteur.pause(); else lecteur?.play?.();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const suivant = plans[rang + (event.key === 'ArrowDown' ? 1 : -1)] || (rang < 0 ? plans[0] : null);
      if (!suivant) return;
      event.preventDefault();
      choisir(suivant);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && rang >= 0) {
      event.preventDefault();
      changer((liste) => retirer(liste, choisiId));
      onChoisir(plans[rang + 1]?.id ?? plans[rang - 1]?.id ?? null);
    }
  };
  useEffect(() => {
    const ecouter = (event) => raccourcis.current?.(event);
    window.addEventListener('keydown', ecouter);
    return () => window.removeEventListener('keydown', ecouter);
  }, []);

  // Le plan choisi reste visible quand on parcourt la liste au clavier.
  const liste = useRef(null);
  useEffect(() => {
    if (!choisiId) return;
    const rang = plans.findIndex((p) => p.id === choisiId) + 1;
    liste.current?.querySelector(`[data-plan="${rang}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [choisiId, plans]);

  const finGlisser = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const vers = plans.findIndex((p) => p.id === over.id);
    changer((liste) => deplacer(liste, active.id, { vers }));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={d.deroule}>
      <div className="flex h-12 shrink-0 items-baseline justify-between gap-3 border-b border-[var(--editor-border)] px-4 pt-3.5">
        <h3 className="text-sm font-bold text-[color:var(--editor-text)]">{d.deroule}</h3>
        <p className="text-xs text-[color:var(--editor-muted)]">{d.resume(plans.length, dureeParlee(total))}</p>
      </div>
      {plans.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Film size={30} className="text-[color:var(--editor-muted)] opacity-50" aria-hidden="true" />
          <p className="text-base font-bold text-[color:var(--editor-text)]">{d.videTitre}</p>
          <ol className="max-w-[30ch] space-y-1.5 text-left text-sm leading-6 text-[color:var(--editor-muted)]">
            <li>1. {d.videEtape1}</li>
            <li>2. {d.videEtape2}</li>
            <li>3. {d.videEtape3}</li>
          </ol>
        </div>
      ) : (
        <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={finGlisser}>
          <SortableContext items={plans.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ol ref={liste} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {plans.map((plan, i) => (
                <Plan
                  key={plan.id}
                  plan={plan}
                  premier={i === 0}
                  dernier={i === plans.length - 1}
                  choisi={plan.id === choisiId}
                  aLEcran={plan.id === aLEcranId}
                  nomPays={nomPays}
                  onChoisir={() => choisir(plan)}
                  onRaccourcir={() => onRaccourcir(plan.clip)}
                  onNom={() => onNom(plan.clip)}
                  onSousTitres={() => onSousTitres(plan.clip)}
                  onEnchainement={(type) => changer((liste) => liste.map((c) => (
                    (c.instanceId || c.id) === plan.id
                      ? { ...c, transition: type === 'none' ? undefined : { type, duration: c.transition?.duration || 0.5 } }
                      : c
                  )))}
                  onMonter={() => changer((liste) => deplacer(liste, plan.id, { pas: -1 }))}
                  onDescendre={() => changer((liste) => deplacer(liste, plan.id, { pas: 1 }))}
                  onDupliquer={() => changer((liste) => dupliquer(liste, plan.id, nouvelId()))}
                  onRetirer={() => { changer((liste) => retirer(liste, plan.id)); onChoisir(null); }}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
