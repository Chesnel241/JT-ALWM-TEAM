import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListOrdered, Mic2, Save, Check, Loader2, ArrowLeft, Paperclip, AlertCircle,
} from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { UPLOAD_ACCEPT } from '../lib/mediaTypes.js';
import { readAdminPassword } from '../lib/adminSession.js';
import EmptyState from './EmptyState.jsx';

/**
 * Les deux rubriques du journal : le conducteur et le Mot du JT.
 *
 * Elles étaient rangées parmi les pays — « Titres & Rappels JT » et « Mot du
 * JT » apparaissaient dans la liste des drapeaux — alors que ce ne sont pas
 * des pays. Le conducteur recense les reportages de TOUS les pays ; le Mot du
 * JT est l'intervention filmée de quelqu'un. Chacune a donc désormais son
 * écran, et ses propres champs.
 *
 * Un seul composant sert les deux : c'est le serveur qui décrit les champs
 * (data/rubriques.js), l'écran les rend. Ajouter un champ ne demandera rien
 * ici.
 */

const ICONES = { conducteur: ListOrdered, motDuJt: Mic2 };

export default function RubriqueView({ cle, selectedWeek, onBack, isActive = true }) {
  const { addToast } = useToast();

  const [rubrique, setRubrique] = useState(null);
  const [champs, setChamps] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enregistrement, setEnregistrement] = useState('repos'); // repos | en_cours | fait
  const [fichiers, setFichiers] = useState([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [sujets, setSujets] = useState([]);
  const entreeFichier = useRef(null);

  const Icone = ICONES[cle] || ListOrdered;

  const recharger = useCallback(() => {
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
        setFichiers(Array.isArray(envois) ? envois : []);
      })
      .catch((err) => setErreur(err.message || 'Chargement impossible.'))
      .finally(() => setChargement(false));
  }, [selectedWeek, cle]);

  useEffect(() => { if (isActive) recharger(); }, [isActive, recharger]);

  // Le conducteur recense les reportages de tous les pays : on les montre en
  // regard de la saisie, puisque c'est exactement ce qu'il sert à lister.
  useEffect(() => {
    if (cle !== 'conducteur' || !selectedWeek || !isActive) { setSujets([]); return; }
    api.getSujets(selectedWeek, null, readAdminPassword())
      .then((l) => setSujets(Array.isArray(l) ? l : []))
      .catch(() => setSujets([]));
  }, [cle, selectedWeek, isActive]);

  const enregistrer = async () => {
    setEnregistrement('en_cours');
    try {
      await api.setRubrique(selectedWeek, cle, champs);
      setEnregistrement('fait');
      setTimeout(() => setEnregistrement('repos'), 2200);
    } catch (err) {
      setEnregistrement('repos');
      addToast(err.message || 'Enregistrement impossible.', 'error', 5000);
    }
  };

  const envoyerFichier = async (event) => {
    const fichier = event.target.files?.[0];
    event.target.value = '';
    if (!fichier) return;
    setEnvoiEnCours(true);
    try {
      await api.uploadFile(selectedWeek, rubriqueBin(cle), fichier, {
        reportage: rubrique?.nom || '',
        adminPassword: readAdminPassword() || undefined,
      });
      addToast('Fichier bien reçu.', 'success', 3000);
      recharger();
    } catch (err) {
      addToast(err.message || "L'envoi n'a pas abouti.", 'error', 5000);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const parPays = useMemo(() => {
    const groupes = new Map();
    for (const s of sujets) {
      if (!groupes.has(s.countryId)) groupes.set(s.countryId, []);
      groupes.get(s.countryId).push(s);
    }
    return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sujets]);

  if (chargement) {
    return <p className="text-center text-sm text-[color:var(--muted)] py-16">Chargement…</p>;
  }

  if (erreur || !rubrique) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState title="Rubrique indisponible" hint={erreur || 'Réessayez dans un instant.'} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {onBack && (
        <button onClick={onBack} type="button" className="btn btn-ghost border border-[var(--border)] py-1.5 text-sm mb-5 motion-tap">
          <ArrowLeft size={15} aria-hidden="true" /> Retour
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

      {/* Les champs, décrits par le serveur. */}
      <section className="space-y-4">
        {rubrique.champs.map((champ) => (
          <label key={champ.cle} className="block">
            <span className="block text-sm font-bold text-[color:var(--ink)] mb-1.5">{champ.libelle}</span>
            {champ.multiligne ? (
              <textarea
                rows={champ.cle === 'texte' ? 12 : 6}
                maxLength={champ.max}
                value={champs[champ.cle] || ''}
                onChange={(e) => setChamps((c) => ({ ...c, [champ.cle]: e.target.value }))}
                className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-2xl px-3.5 py-3 text-sm text-[color:var(--ink)] leading-relaxed resize-y"
              />
            ) : (
              <input
                maxLength={champ.max}
                value={champs[champ.cle] || ''}
                onChange={(e) => setChamps((c) => ({ ...c, [champ.cle]: e.target.value }))}
                className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-2xl px-3.5 py-2.5 text-sm text-[color:var(--ink)]"
              />
            )}
          </label>
        ))}

        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement === 'en_cours'}
          className="btn btn-primary motion-tap w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-2"
        >
          {enregistrement === 'en_cours' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            : enregistrement === 'fait' ? <Check size={16} aria-hidden="true" />
            : <Save size={16} aria-hidden="true" />}
          {enregistrement === 'fait' ? 'Enregistré' : 'Enregistrer'}
        </button>
      </section>

      {/* Le fichier attendu par cette rubrique. */}
      <section className="mt-8 pt-6 border-t border-[var(--border)]">
        <h2 className="text-sm font-bold text-[color:var(--ink)] mb-1">{rubrique.libelleFichier}</h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Tous les formats sont acceptés : envoyez le fichier tel qu'il sort de votre appareil.
        </p>

        <input
          ref={entreeFichier}
          type="file"
          accept={UPLOAD_ACCEPT}
          onChange={envoyerFichier}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => entreeFichier.current?.click()}
          disabled={envoiEnCours}
          className="btn btn-ghost border border-[var(--border)] motion-tap px-4 py-2.5 flex items-center gap-2"
        >
          {envoiEnCours ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Paperclip size={16} aria-hidden="true" />}
          {envoiEnCours ? 'Envoi en cours…' : 'Choisir un fichier'}
        </button>

        {fichiers.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {fichiers.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm rounded-xl bg-[var(--paper)] border border-[var(--border)] px-3 py-2">
                <Check size={14} className="text-[color:var(--ok,#00654f)] shrink-0" aria-hidden="true" />
                <a
                  href={`${API_BASE}/uploads/${f.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[color:var(--ink)] hover:underline"
                >
                  {f.name}
                </a>
                <span className="ml-auto text-xs text-[color:var(--muted)] shrink-0">{f.size}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ce que le conducteur recense. */}
      {cle === 'conducteur' && (
        <section className="mt-8 pt-6 border-t border-[var(--border)]">
          <h2 className="text-sm font-bold text-[color:var(--ink)] mb-1">Les reportages de la semaine</h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Tous pays confondus — c'est ce que le conducteur met bout à bout.
          </p>

          {parPays.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)] flex items-center gap-2">
              <AlertCircle size={15} aria-hidden="true" />
              Aucun reportage reçu pour l'instant.
            </p>
          ) : (
            <ul className="space-y-3">
              {parPays.map(([pays, liste]) => (
                <li key={pays}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{pays}</span>
                  <ul className="mt-1 space-y-1">
                    {liste.map((s) => (
                      <li key={s.id} className="text-sm text-[color:var(--ink)] rounded-lg bg-[var(--paper)] border border-[var(--border)] px-3 py-1.5">
                        {s.titre || 'Sans titre'}
                      </li>
                    ))}
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
