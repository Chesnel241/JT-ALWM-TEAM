import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListOrdered, Mic2, Save, Check, Loader2, ArrowLeft, Paperclip, AlertCircle,
  RefreshCw, X, ListPlus,
} from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { UPLOAD_ACCEPT } from '../lib/mediaTypes.js';
import { readAdminPassword } from '../lib/adminSession.js';
import { formatRelative } from '../lib/dates.js';
import { formaterDuree } from '../lib/duree.js';
import {
  lireBrouillon, ecrireBrouillon, effacerBrouillon, purgerBrouillons, cleRubrique,
} from '../lib/brouillon.js';
import EmptyState from './EmptyState.jsx';

/**
 * Les deux rubriques du journal : le conducteur et le Mot du JT.
 *
 * C'est le seul endroit de la plateforme où l'on écrit longtemps, et c'était
 * le seul où rien ne protégeait ce qui était écrit : une grande zone de texte,
 * un bouton d'enregistrement, et tout perdu au premier onglet fermé — alors
 * que les fichiers, eux, reprennent à l'octet près après une coupure.
 *
 * Trois filets désormais, du plus rapproché au plus large :
 *   1. le brouillon local, écrit à chaque frappe, qui survit au rechargement ;
 *   2. l'enregistrement serveur automatique, deux secondes après la dernière
 *      frappe — pas à chaque caractère, la connexion est souvent limitée ;
 *   3. la révision, qui empêche deux rédacteurs de s'effacer en silence.
 *
 * Un seul composant sert les deux rubriques : c'est le serveur qui décrit les
 * champs (data/rubriques.js), l'écran les rend. Ajouter un champ ne demandera
 * rien ici.
 */

const ICONES = { conducteur: ListOrdered, motDuJt: Mic2 };

// Deux secondes après la dernière frappe. Assez court pour qu'un onglet fermé
// ne coûte presque rien, assez long pour ne pas envoyer une requête par lettre
// sur une connexion mobile facturée au volume.
const DELAI_ENREGISTREMENT_MS = 2000;

export default function RubriqueView({ cle, selectedWeek, onBack, isActive = true }) {
  const { addToast } = useToast();
  const { t, lang } = useI18n();
  const r = t.rubriques;

  const [rubrique, setRubrique] = useState(null);
  const [champs, setChamps] = useState({});
  const [revision, setRevision] = useState(null);
  const [majLe, setMajLe] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  // repos | en_attente | en_cours | fait | brouillon | conflit
  const [etat, setEtat] = useState('repos');
  const [enregistreA, setEnregistreA] = useState('');
  const [brouillonPropose, setBrouillonPropose] = useState(null);
  const [fichiers, setFichiers] = useState([]);
  const [envoi, setEnvoi] = useState(null); // { progression, phase }
  const [sujets, setSujets] = useState([]);

  const entreeFichier = useRef(null);
  const minuteur = useRef(null);
  const annulation = useRef(null);
  // Lus par les effets de sortie sans les remettre en dépendance : sinon la
  // garde « modifications non enregistrées » se réinstallerait à chaque frappe.
  const champsRef = useRef(champs);
  const revisionRef = useRef(revision);
  const etatRef = useRef(etat);
  champsRef.current = champs;
  revisionRef.current = revision;
  etatRef.current = etat;

  const Icone = ICONES[cle] || ListOrdered;
  const cleLocale = cleRubrique(selectedWeek, cle);

  const recharger = useCallback((options = {}) => {
    if (!selectedWeek) return;
    setChargement(true);
    setErreur('');
    Promise.all([
      api.getRubrique(selectedWeek, cle),
      api.getUploads(selectedWeek, rubriqueBin(cle)).catch(() => []),
    ])
      .then(([reponse, envois]) => {
        setRubrique(reponse.rubrique);
        setChamps(reponse.champs || {});
        setRevision(reponse.revision ?? null);
        setMajLe(reponse.majLe || '');
        setFichiers(Array.isArray(envois) ? envois : []);
        setEtat('repos');

        // Un brouillon plus récent que ce que rend le serveur n'est JAMAIS
        // appliqué en silence : la personne doit savoir d'où vient le texte
        // qu'elle a sous les yeux.
        if (!options.ignorerBrouillon) {
          const brouillon = lireBrouillon(cleLocale);
          const serveurLe = reponse.majLe ? Date.parse(reponse.majLe) : 0;
          if (brouillon && Date.parse(brouillon.le) > serveurLe) {
            setBrouillonPropose(brouillon);
          }
        }
      })
      .catch((err) => setErreur(err.message || r.reessayer))
      .finally(() => setChargement(false));
  }, [selectedWeek, cle, cleLocale, r.reessayer]);

  useEffect(() => {
    if (!isActive) return;
    purgerBrouillons();
    recharger();
  }, [isActive, recharger]);

  // Les reportages de la semaine, tous pays confondus : c'est exactement ce
  // que le conducteur sert à mettre bout à bout.
  useEffect(() => {
    if (cle !== 'conducteur' || !selectedWeek || !isActive) { setSujets([]); return; }
    api.getSujets(selectedWeek, null, readAdminPassword())
      .then((l) => setSujets(Array.isArray(l) ? l : []))
      .catch(() => setSujets([]));
  }, [cle, selectedWeek, isActive]);

  /** Écrit au serveur. `manuel` distingue le clic d'un enregistrement de fond. */
  const enregistrer = useCallback(async (valeurs, { manuel = false } = {}) => {
    if (!selectedWeek) return;
    clearTimeout(minuteur.current);
    setEtat('en_cours');
    try {
      const reponse = await api.setRubrique(selectedWeek, cle, valeurs, revisionRef.current);

      if (reponse?.conflit) {
        // Quelqu'un a enregistré entre-temps. On n'écrase RIEN, ni chez lui ni
        // ici : la saisie en cours reste à l'écran, et la personne décide.
        setEtat('conflit');
        setMajLe(reponse.majLe || '');
        ecrireBrouillon(cleLocale, valeurs);
        return;
      }

      setRevision(reponse?.revision ?? revisionRef.current);
      setMajLe(reponse?.majLe || new Date().toISOString());
      setEnregistreA(new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', {
        hour: '2-digit', minute: '2-digit',
      }));
      effacerBrouillon(cleLocale);
      setEtat('fait');
    } catch (err) {
      // Le serveur n'a pas pris : le brouillon local devient le filet, et on
      // le dit plutôt que de laisser croire que c'est enregistré.
      const garde = ecrireBrouillon(cleLocale, valeurs);
      setEtat(garde ? 'brouillon' : 'repos');
      if (manuel) addToast(err.message || r.reessayer, 'error', 5000);
    }
  }, [selectedWeek, cle, cleLocale, lang, addToast, r.reessayer]);

  /** Une frappe : brouillon tout de suite, serveur dans deux secondes. */
  const modifier = (cleChamp, valeur) => {
    setChamps((precedents) => {
      const suivants = { ...precedents, [cleChamp]: valeur };
      ecrireBrouillon(cleLocale, suivants);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => enregistrer(suivants), DELAI_ENREGISTREMENT_MS);
      return suivants;
    });
    setEtat('en_attente');
  };

  // Fermeture de l'onglet avec des modifications en attente. Le navigateur
  // n'affiche pas notre texte, mais il pose bien la question.
  useEffect(() => {
    const avantFermeture = (event) => {
      if (etatRef.current !== 'en_attente' && etatRef.current !== 'conflit') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avantFermeture);
    return () => {
      window.removeEventListener('beforeunload', avantFermeture);
      clearTimeout(minuteur.current);
    };
  }, []);

  // Navigation interne : l'enregistrement différé n'aura pas eu le temps de
  // partir, on le déclenche avant de quitter.
  const quitter = () => {
    if (etatRef.current === 'en_attente') {
      clearTimeout(minuteur.current);
      enregistrer(champsRef.current);
    } else if (etatRef.current === 'conflit'
      && !window.confirm(r.quitterSansEnregistrer)) {
      return;
    }
    onBack?.();
  };

  const reprendreBrouillon = () => {
    if (!brouillonPropose) return;
    setChamps(brouillonPropose.valeurs);
    setBrouillonPropose(null);
    setEtat('en_attente');
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(
      () => enregistrer(brouillonPropose.valeurs), DELAI_ENREGISTREMENT_MS,
    );
  };

  const ignorerBrouillon = () => {
    effacerBrouillon(cleLocale);
    setBrouillonPropose(null);
  };

  const envoyerFichier = async (event) => {
    const fichier = event.target.files?.[0];
    event.target.value = '';
    if (!fichier) return;

    // Un fichier de rubrique est une vidéo ou une voix off : sur une connexion
    // lente, une roue qui tourne sans pourcentage pendant dix minutes ne dit
    // pas si quelque chose avance.
    const controleur = new AbortController();
    annulation.current = controleur;
    setEnvoi({ progression: 0, phase: 'uploading' });
    try {
      await api.uploadFile(selectedWeek, rubriqueBin(cle), fichier, {
        reportage: rubrique?.nom || '',
        adminPassword: readAdminPassword() || undefined,
        signal: controleur.signal,
        onProgress: (progression) => setEnvoi((e) => ({ ...(e || {}), progression })),
        onPhase: (phase) => setEnvoi((e) => ({ ...(e || {}), phase })),
      });
      addToast(r.fichierRecu, 'success', 3000);
      recharger({ ignorerBrouillon: true });
    } catch (err) {
      if (err?.name !== 'AbortError') addToast(err.message || r.fichierEchec, 'error', 5000);
    } finally {
      annulation.current = null;
      setEnvoi(null);
    }
  };

  const annulerEnvoi = () => {
    annulation.current?.abort();
    annulation.current = null;
    setEnvoi(null);
  };

  const parPays = useMemo(() => {
    const groupes = new Map();
    for (const s of sujets) {
      if (!groupes.has(s.countryId)) groupes.set(s.countryId, []);
      groupes.get(s.countryId).push(s);
    }
    return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sujets]);

  /**
   * Dépose le déroulé des reportages reçus dans le champ du conducteur.
   *
   * Il AJOUTE à la fin : la personne a peut-être déjà commencé, et écraser son
   * texte pour lui rendre service serait exactement le contraire.
   */
  const insererDeroule = () => {
    const champTexte = rubrique?.champs?.find((c) => c.multiligne)?.cle;
    if (!champTexte || parPays.length === 0) return;

    const lignes = [];
    for (const [pays, liste] of parPays) {
      lignes.push(pays.toUpperCase());
      for (const s of liste) {
        const duree = formaterDuree(s.duree);
        lignes.push(`  - ${s.titre || '…'}${duree ? ` (${duree})` : ''}`);
      }
      lignes.push('');
    }

    const existant = champs[champTexte] || '';
    const separateur = existant.trim() ? '\n\n' : '';
    modifier(champTexte, `${existant}${separateur}${lignes.join('\n').trimEnd()}`);
    addToast(r.sujetsInsereOk, 'success', 3000);
  };

  if (chargement) {
    return <p className="text-center text-sm text-[color:var(--muted)] py-16">{r.chargement}</p>;
  }

  if (erreur || !rubrique) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState title={r.indisponible} hint={erreur || r.reessayer} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {onBack && (
        <button onClick={quitter} type="button" className="btn btn-ghost border border-[var(--border)] py-1.5 text-sm mb-5 motion-tap">
          <ArrowLeft size={15} aria-hidden="true" /> {r.retour}
        </button>
      )}

      <header className="flex items-start gap-3 mb-6">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center">
          <Icone size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[color:var(--ink)] leading-tight">{rubrique.nom}</h1>
          <p className="text-sm text-[color:var(--muted)] mt-0.5">{rubrique.description}</p>
        </div>
      </header>

      {/* Un brouillon plus récent que le serveur : proposé, jamais imposé. */}
      {brouillonPropose && (
        <div className="mb-5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--paper)] p-4">
          <p className="text-sm font-bold text-[color:var(--ink)]">{r.brouillonLocal}</p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">
            {r.modifieLe(formatRelative(brouillonPropose.le, lang))}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={reprendreBrouillon} className="btn btn-primary py-1.5 px-4 text-sm motion-tap">
              {r.conflitRecharger}
            </button>
            <button type="button" onClick={ignorerBrouillon} className="btn btn-ghost border border-[var(--border)] py-1.5 px-4 text-sm motion-tap">
              {r.retour}
            </button>
          </div>
        </div>
      )}

      {/* Conflit : la saisie reste à l'écran, rien n'est écrasé. */}
      {etat === 'conflit' && (
        <div role="alert" className="mb-5 rounded-2xl border border-[var(--signal)]/50 bg-[var(--signal)]/10 p-4">
          <p className="text-sm font-bold text-[color:var(--ink)] flex items-center gap-2">
            <AlertCircle size={16} aria-hidden="true" /> {r.conflitTitre}
          </p>
          <p className="text-xs text-[color:var(--ink)] mt-1">{r.conflitTexte}</p>
          <button
            type="button"
            onClick={() => recharger({ ignorerBrouillon: true })}
            className="btn btn-ghost border border-[var(--border)] mt-3 py-1.5 px-4 text-sm motion-tap"
          >
            <RefreshCw size={14} aria-hidden="true" /> {r.conflitRecharger}
          </button>
        </div>
      )}

      {/* Les champs, décrits par le serveur. */}
      <section className="space-y-4">
        {rubrique.champs.map((champ) => (
          <label key={champ.cle} className="block">
            <span className="block text-sm font-bold text-[color:var(--ink)] mb-1.5">{champ.libelle}</span>
            {champ.multiligne ? (
              <textarea
                id={`rubrique-${cle}-${champ.cle}`}
                rows={champ.cle === 'texte' ? 12 : 6}
                maxLength={champ.max}
                value={champs[champ.cle] || ''}
                onChange={(e) => modifier(champ.cle, e.target.value)}
                className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-2xl px-3.5 py-3 text-sm text-[color:var(--ink)] leading-relaxed resize-y"
              />
            ) : (
              <input
                id={`rubrique-${cle}-${champ.cle}`}
                maxLength={champ.max}
                value={champs[champ.cle] || ''}
                onChange={(e) => modifier(champ.cle, e.target.value)}
                className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-2xl px-3.5 py-2.5 text-sm text-[color:var(--ink)]"
              />
            )}
          </label>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => enregistrer(champs, { manuel: true })}
            disabled={etat === 'en_cours'}
            className="btn btn-primary motion-tap px-6 py-2.5 flex items-center justify-center gap-2"
          >
            {etat === 'en_cours' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              : etat === 'fait' ? <Check size={16} aria-hidden="true" />
              : <Save size={16} aria-hidden="true" />}
            {etat === 'en_cours' ? r.enregistrement : r.enregistrer}
          </button>

          {/* L'état réel, dit sans détour : ce qui est parti, ce qui ne l'est
              pas encore, et ce qui n'a pu être gardé qu'ici. */}
          <span role="status" className="text-xs text-[color:var(--muted)]">
            {etat === 'en_cours' && r.enregistrement}
            {etat === 'fait' && enregistreA && r.enregistreA(enregistreA)}
            {etat === 'brouillon' && r.brouillonLocal}
            {etat === 'repos' && majLe && r.modifieLe(formatRelative(majLe, lang))}
          </span>
        </div>
      </section>

      {/* Le fichier attendu par cette rubrique. */}
      <section className="mt-8 pt-6 border-t border-[var(--border)]">
        <h2 className="text-sm font-bold text-[color:var(--ink)] mb-1">{rubrique.libelleFichier}</h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">{r.fichierTousFormats}</p>

        <input
          ref={entreeFichier}
          type="file"
          accept={UPLOAD_ACCEPT}
          onChange={envoyerFichier}
          className="hidden"
        />

        {envoi ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-3.5">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="animate-spin shrink-0 text-[color:var(--accent-deep)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[color:var(--ink)]">
                {r.fichierEnvoi} {Math.round(envoi.progression || 0)} %
              </span>
              <button
                type="button"
                onClick={annulerEnvoi}
                className="ml-auto btn btn-ghost border border-[var(--border)] py-1 px-3 text-xs motion-tap"
              >
                <X size={13} aria-hidden="true" /> {r.fichierAnnuler}
              </button>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--paper-2)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--action)] transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, envoi.progression || 0))}%` }}
                role="progressbar"
                aria-valuenow={Math.round(envoi.progression || 0)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => entreeFichier.current?.click()}
            className="btn btn-ghost border border-[var(--border)] motion-tap px-4 py-2.5 flex items-center gap-2"
          >
            <Paperclip size={16} aria-hidden="true" />
            {r.fichierChoisir}
          </button>
        )}

        {fichiers.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {fichiers.map((f) => {
              const duree = formaterDuree(f.duree);
              return (
                <li key={f.id} className="flex items-center gap-2 text-sm rounded-xl bg-[var(--paper)] border border-[var(--border)] px-3 py-2">
                  <Check size={14} className="text-[color:var(--success)] shrink-0" aria-hidden="true" />
                  <a
                    href={`${API_BASE}/uploads/${f.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[color:var(--ink)] hover:underline"
                  >
                    {f.name}
                  </a>
                  <span className="ml-auto text-xs text-[color:var(--muted)] shrink-0">
                    {duree ? `${duree} · ${f.size}` : f.size}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ce que le conducteur recense. */}
      {cle === 'conducteur' && (
        <section className="mt-8 pt-6 border-t border-[var(--border)]">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-[color:var(--ink)] mb-1">{r.sujetsTitre}</h2>
              <p className="text-xs text-[color:var(--muted)]">{r.sujetsSous}</p>
            </div>
            {parPays.length > 0 && (
              <button
                type="button"
                onClick={insererDeroule}
                className="btn btn-ghost border border-[var(--border)] py-1.5 px-3.5 text-xs motion-tap shrink-0"
              >
                <ListPlus size={14} aria-hidden="true" /> {r.sujetsInserer}
              </button>
            )}
          </div>

          {parPays.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)] flex items-center gap-2">
              <AlertCircle size={15} aria-hidden="true" />
              {r.sujetsAucun}
            </p>
          ) : (
            <ul className="space-y-3">
              {parPays.map(([pays, liste]) => (
                <li key={pays}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{pays}</span>
                  <ul className="mt-1 space-y-1">
                    {liste.map((s) => {
                      const duree = formaterDuree(s.duree);
                      return (
                        <li key={s.id} className="flex items-center gap-2 text-sm text-[color:var(--ink)] rounded-lg bg-[var(--paper)] border border-[var(--border)] px-3 py-1.5">
                          <span className="truncate">{s.titre || '…'}</span>
                          {duree && (
                            <span className="ml-auto text-xs text-[color:var(--muted)] shrink-0">{duree}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Le tiroir de rangement d'une rubrique, côté fichiers. */
function rubriqueBin(cle) {
  return cle === 'motDuJt' ? 'mj' : 'tj';
}
