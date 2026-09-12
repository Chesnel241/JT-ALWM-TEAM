import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Film, Palette, Check, Loader2, Circle, UserPlus, X, ListChecks, ChevronDown,
} from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { readAdminPassword } from '../lib/adminSession.js';
import EmptyState from './EmptyState.jsx';

/**
 * Planning des monteurs.
 *
 * Deux personnes par semaine : une à l'assemblage, une à l'habillage, chacune
 * avec son propre avancement. En dessous, les reportages de la semaine —
 * tous pays confondus — à cocher au fur et à mesure du montage.
 *
 * Le planning porte SES semaines, et non celles du sélecteur : celui-ci
 * n'expose qu'une fenêtre de deux semaines, alors qu'une programmation se
 * regarde deux mois à l'avance.
 *
 * Le numéro affiché (« Sem. 18 ») est celui de la rédaction, qui ne coïncide
 * pas avec la semaine ISO servant de clé : leur Sem. 18 est notre 2026-w37.
 */

const ROLES = [
  { cle: 'assemblage', libelle: 'Assemblage', Icone: Film },
  { cle: 'habillage', libelle: 'Habillage', Icone: Palette },
];

const ETATS = [
  { cle: 'a_faire', libelle: 'À faire', Icone: Circle, teinte: 'var(--muted)', fond: 'var(--paper-2)' },
  { cle: 'en_cours', libelle: 'En cours', Icone: Loader2, teinte: '#8a5a00', fond: 'rgba(180,120,0,0.12)' },
  { cle: 'termine', libelle: 'Terminé', Icone: Check, teinte: '#00654f', fond: 'rgba(0,128,101,0.14)' },
];

const etatDe = (cle) => ETATS.find((e) => e.cle === cle) || ETATS[0];

/** « 2026-w37 » → « 7 – 13 sept. », sans dépendre de la liste des semaines. */
function datesDeLaSemaine(weekId) {
  const m = /^(\d{4})-w(\d{1,2})$/.exec(weekId);
  if (!m) return '';
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const lundi = new Date(jan4);
  lundi.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (Number(m[2]) - 1) * 7);
  const dimanche = new Date(lundi);
  dimanche.setUTCDate(lundi.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(lundi)} – ${fmt(dimanche)}`;
}

/** Sélecteur d'avancement : trois états, un seul geste. */
function ChoixEtat({ valeur, onChange, disabled }) {
  return (
    <div className="flex w-full rounded-xl border border-[var(--border)] overflow-hidden" role="group">
      {ETATS.map(({ cle, libelle, Icone, teinte, fond }) => {
        const actif = valeur === cle;
        return (
          <button
            key={cle}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cle)}
            aria-pressed={actif}
            title={libelle}
            className="motion-tap flex flex-1 items-center justify-center gap-1.5 px-1.5 py-1.5 text-[11px] font-bold whitespace-nowrap disabled:opacity-50"
            style={{
              background: actif ? fond : 'transparent',
              color: actif ? teinte : 'var(--muted)',
            }}
          >
            <Icone size={12} className={actif && cle === 'en_cours' ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{libelle}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function PlanningView({ selectedWeek, isActive = true }) {
  const { addToast } = useToast();
  const motDePasse = readAdminPassword();

  const [planning, setPlanning] = useState({ monteurs: [], semaines: {} });
  const [chargement, setChargement] = useState(true);
  const [refusee, setRefusee] = useState(false);
  const [ouverte, setOuverte] = useState(selectedWeek || '');
  const [sujets, setSujets] = useState([]);
  const [nouveauMonteur, setNouveauMonteur] = useState('');

  const recharger = useCallback(() => {
    if (!motDePasse) { setChargement(false); setRefusee(true); return; }
    setChargement(true);
    api.getPlanning(motDePasse)
      .then((p) => { setPlanning(p); setRefusee(false); })
      .catch(() => setRefusee(true))
      .finally(() => setChargement(false));
  }, [motDePasse]);

  useEffect(() => { if (isActive) recharger(); }, [isActive, recharger]);

  // Les reportages de la semaine ouverte, tous pays confondus.
  useEffect(() => {
    if (!ouverte || !motDePasse) { setSujets([]); return; }
    api.getPlanningSujets(ouverte, motDePasse)
      .then((l) => setSujets(Array.isArray(l) ? l : []))
      .catch(() => setSujets([]));
  }, [ouverte, motDePasse, planning]);

  const semainesTriees = useMemo(
    () => Object.entries(planning.semaines).sort(([a], [b]) => a.localeCompare(b)),
    [planning.semaines],
  );

  const nomDe = useCallback(
    (id) => planning.monteurs.find((m) => m.id === id)?.nom || null,
    [planning.monteurs],
  );

  const changerAffectation = async (weekId, role, monteurId) => {
    try {
      await api.affecterSemaine(weekId, { [role]: monteurId || null }, motDePasse);
      recharger();
    } catch (err) {
      addToast(err.message || 'Affectation impossible.', 'error', 4000);
    }
  };

  const changerEtat = async (weekId, role, etat) => {
    // Optimiste : le monteur clique et voit, la requête suit.
    setPlanning((p) => ({
      ...p,
      semaines: { ...p.semaines, [weekId]: { ...p.semaines[weekId], [role]: { ...p.semaines[weekId][role], etat } } },
    }));
    try {
      await api.majEtatMontage(weekId, role, etat, motDePasse);
    } catch (err) {
      addToast(err.message || 'Enregistrement impossible.', 'error', 4000);
      recharger();
    }
  };

  const cocherSujet = async (sujetId, monte) => {
    setSujets((l) => l.map((s) => (s.id === sujetId ? { ...s, monte } : s)));
    try {
      await api.marquerSujetMonte(ouverte, sujetId, monte, motDePasse);
    } catch (err) {
      addToast(err.message || 'Enregistrement impossible.', 'error', 4000);
      setSujets((l) => l.map((s) => (s.id === sujetId ? { ...s, monte: !monte } : s)));
    }
  };

  const ajouterMonteur = async (e) => {
    e.preventDefault();
    const nom = nouveauMonteur.trim();
    if (!nom) return;
    try {
      await api.ajouterMonteur(nom, motDePasse);
      setNouveauMonteur('');
      recharger();
    } catch (err) {
      addToast(err.message || 'Ajout impossible.', 'error', 4000);
    }
  };

  if (refusee) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          title="Programmation réservée à l'équipe montage"
          hint="Déverrouillez l'espace montage pour voir et modifier le planning."
        />
      </div>
    );
  }

  const montes = sujets.filter((s) => s.monte).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[color:var(--ink)] flex items-center gap-2.5">
            <CalendarDays size={26} className="text-[color:var(--accent-deep)]" aria-hidden="true" />
            Programmation
          </h1>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Qui monte quoi, chaque semaine, et où en est le journal.
          </p>
        </div>

        <form onSubmit={ajouterMonteur} className="flex items-center gap-2">
          <input
            value={nouveauMonteur}
            onChange={(e) => setNouveauMonteur(e.target.value)}
            placeholder="Ajouter un monteur"
            aria-label="Nom du monteur à ajouter"
            className="bg-[var(--paper)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] w-44"
          />
          <button type="submit" className="btn btn-ghost border border-[var(--border)] py-2 px-3 motion-tap" title="Ajouter">
            <UserPlus size={16} aria-hidden="true" />
          </button>
        </form>
      </header>

      {chargement ? (
        <p className="text-sm text-[color:var(--muted)] py-10 text-center">Chargement de la programmation…</p>
      ) : semainesTriees.length === 0 ? (
        <EmptyState title="Aucune semaine programmée" hint="Ajoutez des monteurs, puis affectez-les semaine par semaine." />
      ) : (
        <>
        {/* Les deux rôles portaient une simple icône : rien ne disait lequel
            était l'assemblage. Le tableau de la rédaction a des titres de
            colonnes, l'écran aussi. */}
        <div className="hidden md:grid grid-cols-[minmax(11rem,1fr)_1fr_1fr] gap-3 px-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
          <span>Semaine &amp; dates</span>
          <span className="flex items-center gap-1.5"><Film size={13} aria-hidden="true" /> Assemblage</span>
          <span className="flex items-center gap-1.5"><Palette size={13} aria-hidden="true" /> Habillage</span>
        </div>
        <ul className="motion-stagger space-y-3">
          {semainesTriees.map(([weekId, semaine]) => {
            const courante = weekId === selectedWeek;
            const deplie = weekId === ouverte;
            return (
              <li
                key={weekId}
                className="rounded-2xl border bg-[var(--paper)] overflow-hidden motion-enter"
                style={{
                  borderColor: courante ? 'var(--accent)' : 'var(--border)',
                  boxShadow: courante ? '0 0 0 1px var(--accent)' : 'none',
                }}
              >
                <div className="grid md:grid-cols-[minmax(11rem,1fr)_1fr_1fr] items-center gap-3 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setOuverte(deplie ? '' : weekId)}
                    aria-expanded={deplie}
                    className="motion-tap flex items-center gap-2 text-left"
                  >
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="text-[color:var(--muted)] transition-transform"
                      style={{ transform: deplie ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    />
                    <span>
                      <span className="font-bold text-[color:var(--ink)] block leading-tight">
                        {semaine.libelle || `Semaine ${weekId.split('-w')[1]}`}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">{datesDeLaSemaine(weekId)}</span>
                    </span>
                    {courante && (
                      <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] text-[10px] font-bold ml-1">
                        en cours
                      </span>
                    )}
                  </button>

                  {ROLES.map(({ cle, libelle, Icone }) => {
                      const role = semaine[cle] || {};
                      const info = etatDe(role.etat);
                      return (
                        <div key={cle} className="flex flex-col gap-1.5 min-w-0">
                          {/* Le titre de colonne n'existe qu'en grand écran :
                              sur téléphone, l'icône reste le seul repère, donc
                              elle est doublée d'un libellé. */}
                          <span className="flex items-center gap-1.5 md:hidden text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                            <Icone size={13} aria-hidden="true" /> {libelle}
                          </span>
                          <select
                            value={role.monteurId || ''}
                            onChange={(e) => changerAffectation(weekId, cle, e.target.value)}
                            aria-label={`${libelle} — semaine ${semaine.libelle || weekId}`}
                            className="bg-[var(--paper-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[color:var(--ink)] w-full"
                          >
                            <option value="">— {libelle} —</option>
                            {planning.monteurs.map((m) => (
                              <option key={m.id} value={m.id}>{m.nom}</option>
                            ))}
                          </select>
                          <ChoixEtat
                            valeur={info.cle}
                            disabled={!role.monteurId}
                            onChange={(etat) => changerEtat(weekId, cle, etat)}
                          />
                        </div>
                      );
                  })}
                </div>

                {deplie && (
                  <div className="border-t border-[var(--border)] bg-[var(--paper-2)] p-3 sm:p-4 motion-enter">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-sm font-bold text-[color:var(--ink)] flex items-center gap-2">
                        <ListChecks size={16} aria-hidden="true" />
                        Conducteur de la semaine
                      </h2>
                      <span className="text-xs text-[color:var(--muted)] font-semibold tabular-nums">
                        {montes} / {sujets.length} monté{montes > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Avancement du montage, à la lecture d'un coup d'œil. */}
                    <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden mb-4">
                      <div
                        className="motion-gauge h-full rounded-full bg-[color:var(--accent)]"
                        style={{ width: '100%', transform: `scaleX(${sujets.length ? montes / sujets.length : 0})` }}
                      />
                    </div>

                    {sujets.length === 0 ? (
                      <p className="text-sm text-[color:var(--muted)]">
                        Aucun reportage reçu pour cette semaine.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {sujets.map((sujet) => (
                          <li key={sujet.id}>
                            <label className="motion-tap flex items-center gap-3 rounded-xl px-3 py-2 bg-[var(--paper)] border border-[var(--border)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(sujet.monte)}
                                onChange={(e) => cocherSujet(sujet.id, e.target.checked)}
                                className="h-4 w-4 accent-[var(--accent)] shrink-0"
                              />
                              <span className="min-w-0 flex-grow">
                                <span
                                  className="block text-sm font-semibold text-[color:var(--ink)] truncate"
                                  style={{ textDecoration: sujet.monte ? 'line-through' : 'none', opacity: sujet.monte ? 0.6 : 1 }}
                                >
                                  {sujet.titre || 'Sans titre'}
                                </span>
                                <span className="text-xs text-[color:var(--muted)]">
                                  {sujet.countryId?.toUpperCase()} · {sujet.nbPieces || 0} pièce{(sujet.nbPieces || 0) > 1 ? 's' : ''}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}

      {planning.monteurs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">
            L'équipe
          </h2>
          <ul className="flex flex-wrap gap-2">
            {planning.monteurs.map((m) => (
              <li key={m.id} className="flex items-center gap-1.5 rounded-full bg-[var(--paper)] border border-[var(--border)] pl-3 pr-1.5 py-1">
                <span className="text-sm font-semibold text-[color:var(--ink)]">{m.nom}</span>
                <button
                  type="button"
                  title={`Retirer ${m.nom}`}
                  aria-label={`Retirer ${m.nom}`}
                  onClick={async () => {
                    try {
                      await api.retirerMonteur(m.id, motDePasse);
                      recharger();
                    } catch (err) {
                      addToast(err.message || 'Retrait impossible.', 'error', 4000);
                    }
                  }}
                  className="motion-tap h-5 w-5 rounded-full flex items-center justify-center text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Retirer quelqu'un ne touche pas aux semaines déjà passées.
          </p>
        </section>
      )}
    </div>
  );
}
