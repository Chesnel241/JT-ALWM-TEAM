import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useOptionalToast } from '../hooks/useToast.jsx';
import { BarChart2, CheckCircle, ChevronDown, Clock, Download, Lock, RefreshCw } from 'lucide-react';
import { formatAbsolute } from '../lib/dates.js';
import { echeanceApresDelai, heureCourte } from '../lib/delais.js';
import { readAdminPassword, saveAdminPassword } from '../lib/adminSession.js';
import { indicateurs, motifsDeLaPeriode, parPays, participation, versCSV, numeroSemaine } from '../lib/statsHebdo.js';

/**
 * Statistiques et délais.
 *
 * LE BESOIN : la page ne savait que cumuler depuis toujours — fichiers en
 * retard, délais demandés — sans dire si la semaine écoulée allait mieux que
 * les précédentes. Elle montre maintenant les douze dernières semaines : les
 * indicateurs de la dernière semaine terminée avec leur tendance, la
 * participation semaine par semaine, chaque pays et sa fiche, les motifs de
 * refus, et un export pour un tableur. La gestion des délais de la semaine
 * reste en bas, telle quelle.
 *
 * Couleurs du graphique (validées pour les daltonismes, voir index.css,
 * `--graphe-*`) : bleu « à l'heure », orange « en retard », fond « rien
 * reçu ». La couleur n'est jamais seule : légende, libellés et infobulles.
 */

/** « +11 h 40 » après la clôture, « −2 h 05 » avant. */
const minutesEnClair = (min) => {
  if (min === null || min === undefined) return '—';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${min < 0 ? '−' : '+'}${h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`}`;
};

const dureeEnClair = (sec) => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min ${String(r).padStart(2, '0')}`;
};

const octetsEnClair = (o, lang) => {
  if (!o) return '0';
  const go = o / 1024 ** 3;
  const nombre = (n, d) => n.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: d });
  return go >= 1 ? `${nombre(go, 1)} ${lang === 'en' ? 'GB' : 'Go'}` : `${nombre(o / 1024 ** 2, 0)} ${lang === 'en' ? 'MB' : 'Mo'}`;
};

/** La petite courbe de tendance d'un indicateur : 2 px, la semaine récente marquée. */
function Tendance({ serie }) {
  const points = serie.filter((p) => Number.isFinite(p.valeur));
  if (points.length < 2) return <span className="block h-7" aria-hidden="true" />;
  const valeurs = points.map((p) => p.valeur);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const L = 100;
  const H = 28;
  const x = (i) => (serie.length <= 1 ? L : 4 + (i / (serie.length - 1)) * (L - 8));
  const y = (v) => (max === min ? H / 2 : 4 + (1 - (v - min) / (max - min)) * (H - 8));
  // Une semaine sans valeur coupe la courbe : on ne relie pas ce qu'on ignore.
  const segments = [];
  let courant = [];
  serie.forEach((p, i) => {
    if (Number.isFinite(p.valeur)) courant.push(`${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`);
    else if (courant.length) { segments.push(courant); courant = []; }
  });
  if (courant.length) segments.push(courant);
  const dernier = serie.length - 1;
  const fin = serie[dernier];
  // La courbe s'étire avec la tuile ; le point final, lui, reste rond : il
  // est posé par-dessus, en proportion, plutôt que dessiné dans le SVG étiré.
  return (
    <span className="stats-tendance relative block h-7 w-full" aria-hidden="true">
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {segments.map((morceau, k) => (
          <polyline key={k} points={morceau.join(' ')} className="stats-tendance-trait" fill="none" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {Number.isFinite(fin?.valeur) && (
        <span className="stats-tendance-point" style={{ left: `${x(dernier)}%`, top: `${(y(fin.valeur) / H) * 100}%` }} />
      )}
    </span>
  );
}

function Tuile({ libelle, valeur, detail, serie, i }) {
  return (
    <div className="stats-tuile flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4" style={{ '--i': i }}>
      <span className="text-xs font-semibold text-[color:var(--muted)]">{libelle}</span>
      <span className="text-2xl font-semibold tabular-nums text-[color:var(--ink)]">{valeur}</span>
      <span className="min-h-[1rem] text-xs text-[color:var(--muted)]">{detail}</span>
      <Tendance serie={serie} />
    </div>
  );
}

/** Une case de la semaine d'un pays : sa couleur, et ce qu'elle dit en clair. */
const CASE = {
  aLHeure: 'bg-[var(--graphe-1)]',
  enRetard: 'bg-[var(--graphe-2)]',
  absent: 'bg-transparent border border-[var(--border)]',
};

export default function StatsView({ weeks, selectedWeek, countries = [] }) {
  const { lang, t } = useI18n();
  const s = t.stats;
  const { addToast } = useOptionalToast();
  // Le mot de passe de la session montage : on le redemandait ici alors que
  // le monteur venait de le taper dans l'espace montage.
  const [adminPassword, setAdminPassword] = useState(() => readAdminPassword());
  // Les pays par leur nom : « SN » ou « CM » obligeaient à traduire de tête.
  const nomPays = (id) => (id === 'inconnu' ? s.paysInconnu : countries.find((c) => c.id === id)?.name || String(id || '').toUpperCase());
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fiche, setFiche] = useState(null);
  const [survol, setSurvol] = useState(null);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const ok = await api.checkAdminPassword(adminPassword);
      if (ok) {
        setIsAuthenticatedAdmin(true);
        saveAdminPassword(adminPassword);
      } else {
        setAuthError(s.motDePasseIncorrect);
      }
    } catch (err) {
      setAuthError(err.message || s.erreurConnexion);
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    const enSession = readAdminPassword();
    if (!enSession) return undefined;
    let annule = false;
    api.checkAdminPassword(enSession)
      .then((ok) => { if (ok && !annule) setIsAuthenticatedAdmin(true); })
      .catch(() => {});
    return () => { annule = true; };
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      setStatsData(await api.getStats(adminPassword));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticatedAdmin) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticatedAdmin, selectedWeek]);

  const semaines = useMemo(() => (Array.isArray(statsData?.semaines) ? statsData.semaines : []), [statsData]);
  const ind = useMemo(() => indicateurs(semaines), [semaines]);
  const colonnes = useMemo(() => participation(semaines), [semaines]);
  const lignes = useMemo(
    () => parPays(semaines, statsData?.paysAttendus || []).sort((a, b) => b.actives - a.actives || nomPays(a.id).localeCompare(nomPays(b.id), lang)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semaines, statsData, countries, lang],
  );
  const motifs = useMemo(() => motifsDeLaPeriode(semaines), [semaines]);

  const handleApprove = async (countryId, minutes) => {
    try {
      const ext = await api.approveDelay(selectedWeek, countryId, minutes, adminPassword);
      if (ext?.extendedUntil) {
        addToast(t.delais.accorde(nomPays(countryId), heureCourte(new Date(ext.extendedUntil), lang)), 'success', 5000);
      }
      loadStats();
    } catch (err) {
      console.error(err);
      addToast(t.delais.echecApprobation, 'error', 5000);
    }
  };

  const handleGlobalDelay = async (minutes) => {
    try {
      const ext = await api.setGlobalDelay(selectedWeek, minutes, adminPassword);
      if (ext?.extendedUntil) {
        addToast(t.delais.accorde(t.delais.tousLesPays, heureCourte(new Date(ext.extendedUntil), lang)), 'success', 5000);
      }
      loadStats();
    } catch (err) {
      console.error(err);
      addToast(t.delais.echecDelaiGlobal, 'error', 5000);
    }
  };

  const exporter = () => {
    const texte = versCSV(semaines, nomPays, s.csvEntetes);
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `statistiques-jt-alwm-${semaines.at(-1)?.weekId || ''}-${semaines[0]?.weekId || ''}.csv`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isAuthenticatedAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-[var(--paper)] rounded-2xl shadow-sm border border-[var(--border)]">
        <h2 className="text-2xl font-bold text-center mb-6 text-[color:var(--ink)] flex items-center justify-center gap-2">
          <Lock size={24} aria-hidden="true" /> {s.titreVerrou}
        </h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label htmlFor="stats-mdp" className="block text-sm font-medium mb-1 text-[color:var(--ink)]">{s.motDePasse}</label>
            <input
              id="stats-mdp"
              type="password"
              className="w-full bg-[var(--paper-2)] border border-[var(--border)] rounded-lg px-4 py-2 text-base focus:ring-2 focus:ring-[var(--accent)] text-[color:var(--ink)]"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {authError && <p role="alert" className="text-[color:var(--cta-orange-deep)] text-sm text-center">{authError}</p>}
          <button type="submit" disabled={isAuthenticating} className="w-full btn btn-primary flex justify-center py-2">
            {isAuthenticating ? s.verification : s.deverrouiller}
          </button>
        </form>
      </div>
    );
  }

  const currentDelays = statsData?.delaysByWeek?.[selectedWeek] || { global: null, requests: {} };
  const requests = Object.entries(currentDelays.requests || {});
  const enAttente = requests.filter(([, r]) => r.status !== 'approved').length;
  // Chaque bouton dit l'heure qu'il donnera, calculée comme le serveur le
  // fera : on ne découvre plus après coup qu'un « +1 h » a raccourci un délai.
  const cutoffAt = weeks?.find((w) => w.id === selectedWeek)?.cutoffAt;
  const apres = (minutes, demande = null) => t.delais.jusqua(heureCourte(
    echeanceApresDelai({ cutoffAt, global: currentDelays.global, demande, minutes }),
    lang,
  ));
  const semaineDe = (weekId) => s.semaineCourte(numeroSemaine(weekId));
  const sem = ind.semaine ? semaineDe(ind.semaine) : '';
  const nombre = (n) => (Number.isFinite(n) ? n.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR') : '—');
  const maxMotif = motifs[0]?.n || 1;

  const tuiles = [
    { cle: 'participation', libelle: s.participation, valeur: ind.participation.valeur === null ? '—' : `${ind.participation.valeur} %`, detail: sem },
    { cle: 'aLHeure', libelle: s.aLHeure, valeur: ind.aLHeure.valeur === null ? '—' : `${ind.aLHeure.valeur} %`, detail: s.aLHeureDetail },
    { cle: 'delais', libelle: s.delais, valeur: nombre(ind.delais.valeur), detail: s.delaisDetail(ind.delaisAccordes) },
    { cle: 'refus', libelle: s.refus, valeur: nombre(ind.refus.valeur), detail: s.refusDetail },
    { cle: 'poids', libelle: s.poids, valeur: octetsEnClair(ind.poids.valeur, lang), detail: ind.gainOctets > 0 ? s.gain(octetsEnClair(ind.gainOctets, lang)) : '' },
    { cle: 'publication', libelle: s.publication, valeur: minutesEnClair(ind.publication.valeur), detail: s.publicationDetail },
    { cle: 'duree', libelle: s.duree, valeur: dureeEnClair(ind.duree.valeur), detail: '' },
    { cle: 'vues', libelle: s.vues, valeur: nombre(ind.vues.valeur), detail: s.vuesDetail },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--ink)] flex items-center gap-3">
            <BarChart2 className="text-[var(--accent)]" size={30} aria-hidden="true" />
            {s.titre}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{s.sousTitre(semaines.length)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {enAttente > 0 && (
            <a href="#stats-delais" className="btn inline-flex flex-row items-center gap-2 bg-v-cta-orange/10 text-[color:var(--cta-orange-deep)] border border-v-cta-orange/40">
              <Clock size={16} aria-hidden="true" /> {s.demandesEnAttente(enAttente)}
            </a>
          )}
          <button type="button" onClick={exporter} disabled={semaines.length === 0} className="btn inline-flex flex-row items-center gap-2 bg-[var(--paper-2)] text-[color:var(--ink)] border border-[var(--border)] disabled:opacity-50">
            <Download size={16} aria-hidden="true" /> {s.exporter}
          </button>
          <button type="button" onClick={loadStats} className="btn inline-flex flex-row items-center gap-2 bg-[var(--paper-2)] text-[color:var(--ink)] border border-[var(--border)]">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" /> {s.rafraichir}
          </button>
        </div>
      </header>

      {semaines.length === 0 ? (
        <p className="panel p-6 text-sm text-[color:var(--muted)]">{isLoading ? s.chargement : s.aucuneDonnee}</p>
      ) : (
        <>
          <section id="tour-stats-indicateurs" aria-labelledby="stats-indicateurs">
            <h2 id="stats-indicateurs" className="sr-only">{s.indicateurs}</h2>
            <div className="motion-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
              {tuiles.map((tuile, i) => <Tuile key={tuile.cle} {...tuile} serie={ind[tuile.cle].serie} i={i} />)}
            </div>
          </section>

          <section className="panel p-6" aria-labelledby="stats-participation">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="stats-participation" className="text-lg font-bold text-[color:var(--ink)]">{s.participationTitre}</h2>
              <ul className="flex flex-wrap gap-4 text-xs text-[color:var(--muted)]" aria-label={s.legende}>
                <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[var(--graphe-1)]" aria-hidden="true" />{s.legendeALHeure}</li>
                <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[var(--graphe-2)]" aria-hidden="true" />{s.legendeEnRetard}</li>
                <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-[var(--border)] bg-[var(--graphe-vide)]" aria-hidden="true" />{s.legendeAbsent}</li>
              </ul>
            </div>
            <div className="relative mt-5 pt-5">
              <div className="stats-colonnes flex h-44 items-stretch gap-2 border-b border-[var(--border)]" role="list">
                {colonnes.map((c, i) => {
                  const derniere = i === colonnes.length - 1;
                  return (
                    <div
                      key={c.weekId}
                      role="listitem"
                      tabIndex={0}
                      aria-label={s.colonneAria(c.numero, c.aLHeure, c.enRetard, c.absents)}
                      onPointerEnter={() => setSurvol(c.weekId)}
                      onPointerLeave={() => setSurvol(null)}
                      onFocus={() => setSurvol(c.weekId)}
                      onBlur={() => setSurvol(null)}
                      className="stats-colonne group relative flex min-w-0 flex-1 flex-col items-center justify-end outline-none"
                      style={{ '--i': i }}
                    >
                      {/* Le seul chiffre écrit sur le graphique : la dernière semaine. */}
                      {derniere && c.attendus > 0 && (
                        <span className="absolute -top-5 text-xs font-semibold tabular-nums text-[color:var(--ink)]">{c.aLHeure + c.enRetard}/{c.attendus}</span>
                      )}
                      {/* Les parts, du bas vers le haut, en proportion : un écart de
                          2 px les sépare, et seule la part du haut est arrondie. */}
                      <div className="stats-pile flex h-full w-full max-w-[24px] flex-col-reverse gap-[2px]">
                        {[['aLHeure', 'var(--graphe-1)'], ['enRetard', 'var(--graphe-2)'], ['absents', 'var(--graphe-vide)']]
                          .filter(([cle]) => c[cle] > 0)
                          .map(([cle, couleur]) => (
                            <span key={cle} className="stats-part" style={{ flex: `${c[cle]} 1 0px`, background: couleur }} />
                          ))}
                      </div>
                      {/* À côté de la colonne, dans le cadre du graphique : au-dessus,
                          elle sortait de la carte pour les semaines pleines. */}
                      {survol === c.weekId && (
                        <div role="tooltip" className={`pointer-events-none absolute top-1/2 z-10 w-max max-w-[14rem] -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-xs shadow-lg ${i >= colonnes.length - 3 ? 'right-[calc(50%+18px)]' : 'left-[calc(50%+18px)]'}`}>
                          <p className="font-bold text-[color:var(--ink)]">{semaineDe(c.weekId)}</p>
                          <p className="mt-1 flex items-center gap-2 text-[color:var(--muted)]"><span className="h-0.5 w-3 bg-[var(--graphe-1)]" aria-hidden="true" /><strong className="text-[color:var(--ink)]">{c.aLHeure}</strong> {s.legendeALHeure}</p>
                          <p className="flex items-center gap-2 text-[color:var(--muted)]"><span className="h-0.5 w-3 bg-[var(--graphe-2)]" aria-hidden="true" /><strong className="text-[color:var(--ink)]">{c.enRetard}</strong> {s.legendeEnRetard}</p>
                          <p className="flex items-center gap-2 text-[color:var(--muted)]"><span className="h-0.5 w-3 bg-[var(--border)]" aria-hidden="true" /><strong className="text-[color:var(--ink)]">{c.absents}</strong> {s.legendeAbsent}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex gap-2" aria-hidden="true">
                {/* Sur un téléphone, le numéro seul : douze « S46 » ne tiennent pas en largeur. */}
                {colonnes.map((c) => (
                  <span key={c.weekId} className="min-w-0 flex-1 text-center text-[11px] tabular-nums text-[color:var(--muted)]">
                    {c.numero ? <><span className="hidden sm:inline">S</span>{c.numero}</> : ''}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="panel overflow-hidden" aria-labelledby="stats-pays">
              <h2 id="stats-pays" className="px-6 pt-6 text-lg font-bold text-[color:var(--ink)]">{s.parPays}</h2>
              <p className="px-6 pt-1 text-xs text-[color:var(--muted)]">{s.parPaysAide}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[color:var(--muted)]">
                      <th scope="col" className="px-6 py-2 font-semibold">{s.colPays}</th>
                      <th scope="col" className="py-2 font-semibold">{s.colSemaines}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{s.colALHeure}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{s.colRefus}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{s.colDelais}</th>
                      <th scope="col" className="px-6 py-2 text-right font-semibold">{s.colVues}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => {
                      const ouverte = fiche === l.id;
                      return (
                        <Fragment key={l.id}>
                          <tr className="border-b border-[var(--border)] last:border-0">
                            <th scope="row" className="px-6 py-2.5 text-left font-semibold text-[color:var(--ink)]">
                              <button
                                type="button"
                                onClick={() => setFiche(ouverte ? null : l.id)}
                                aria-expanded={ouverte}
                                className="flex min-h-[32px] items-center gap-1.5 rounded-lg text-left hover:text-[color:var(--accent-deep)]"
                              >
                                <ChevronDown size={14} className={`stats-chevron shrink-0 ${ouverte ? 'rotate-180' : ''}`} aria-hidden="true" />
                                {nomPays(l.id)}
                              </button>
                            </th>
                            <td className="py-2.5">
                              <span className="flex gap-[3px]" role="img" aria-label={s.casesAria(l.actives, l.semaines)}>
                                {l.cases.map((c) => (
                                  <span key={c.weekId} title={`${semaineDe(c.weekId)} : ${s.etats[c.etat]}`} className={`h-3 w-3 rounded-[3px] ${CASE[c.etat]}`} />
                                ))}
                              </span>
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-[color:var(--ink)]">{l.aLHeure}/{l.semaines}</td>
                            <td className="py-2.5 text-right tabular-nums text-[color:var(--ink)]">{l.refuses}</td>
                            <td className="py-2.5 text-right tabular-nums text-[color:var(--ink)]">{l.delais}</td>
                            <td className="px-6 py-2.5 text-right tabular-nums text-[color:var(--ink)]">{l.vues}</td>
                          </tr>
                          {ouverte && (
                            <tr className="border-b border-[var(--border)] bg-[var(--paper-2)]">
                              <td colSpan={6} className="px-6 py-3">
                                <div className="stats-fiche overflow-x-auto">
                                  <table className="w-full text-xs" aria-label={s.ficheAria(nomPays(l.id))}>
                                    <thead>
                                      <tr className="text-left text-[color:var(--muted)]">
                                        <th scope="col" className="py-1 pr-3 font-semibold">{s.colSemaine}</th>
                                        <th scope="col" className="py-1 pr-3 text-right font-semibold">{s.colFichiers}</th>
                                        <th scope="col" className="py-1 pr-3 text-right font-semibold">{s.colRetard}</th>
                                        <th scope="col" className="py-1 pr-3 text-right font-semibold">{s.colRefus}</th>
                                        <th scope="col" className="py-1 pr-3 font-semibold">{s.colDelai}</th>
                                        <th scope="col" className="py-1 pr-3 text-right font-semibold">{s.colDiffuses}</th>
                                        <th scope="col" className="py-1 text-right font-semibold">{s.colVues}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...l.cases].reverse().map((c) => (
                                        <tr key={c.weekId} className="border-t border-[var(--border)]">
                                          <th scope="row" className="py-1 pr-3 text-left font-semibold text-[color:var(--ink)]">{semaineDe(c.weekId)}</th>
                                          <td className="py-1 pr-3 text-right tabular-nums">{c.fichiers || 0}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{c.enRetard || 0}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{c.refuses || 0}</td>
                                          <td className="py-1 pr-3">{c.delai ? s.delaiEtat[c.delai] : '—'}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{c.sujets ? `${c.diffuses || 0}/${c.sujets}` : '—'}</td>
                                          <td className="py-1 text-right tabular-nums">{(c.vues || 0) + (c.telechargements || 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel p-6" aria-labelledby="stats-motifs">
              <h2 id="stats-motifs" className="text-lg font-bold text-[color:var(--ink)]">{s.motifs}</h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{s.motifsAide}</p>
              {motifs.length === 0 ? (
                <p className="mt-4 text-sm text-[color:var(--muted)]">{s.aucunMotif}</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {motifs.map((m, i) => (
                    <li key={m.texte} style={{ '--i': i }}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 text-[color:var(--ink)]">{m.texte}</span>
                        <span className="shrink-0 tabular-nums font-semibold text-[color:var(--ink)]">{m.n}</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-[var(--paper-2)]">
                        <div className="stats-motif h-2 rounded-full bg-[var(--graphe-1)]" style={{ width: `${(m.n / maxMotif) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}

      <section id="stats-delais" className="panel p-6 scroll-mt-24" aria-labelledby="stats-delais-titre">
        <h2 id="stats-delais-titre" className="text-lg font-bold text-[color:var(--ink)] mb-4 flex items-center gap-2">
          <Clock className="text-[color:var(--cta-orange-deep)]" size={20} aria-hidden="true" /> {s.delaisTitre}
        </h2>
        <div className="mb-6 pb-6 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[color:var(--ink)] mb-3">{s.delaiGlobal}</h3>
          <div className="flex gap-2 flex-wrap">
            {[60, 180, 720].map((m) => (
              <button key={m} type="button" onClick={() => handleGlobalDelay(m)} title={apres(m)} className="btn bg-[var(--paper-2)] border-[var(--border)] hover:bg-[var(--accent)] hover:text-white transition-colors flex flex-col items-center leading-tight">
                <span>+ {m / 60} h</span><span className="text-[11px] font-medium opacity-80">{apres(m)}</span>
              </button>
            ))}
          </div>
          {currentDelays.global?.extendedUntil && (
            <p className="mt-2 text-sm text-[color:var(--muted)] flex items-center gap-1">
              <CheckCircle size={14} className="text-[var(--accent)]" aria-hidden="true" />
              {s.actifJusqua(formatAbsolute(currentDelays.global.extendedUntil, lang))}
            </p>
          )}
        </div>
        <h3 className="font-semibold text-[color:var(--ink)] mb-4">{s.demandesDesPays}</h3>
        {requests.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">{s.aucuneDemande}</p>
        ) : (
          <div className="space-y-4">
            {requests.map(([countryId, req]) => (
              <div key={countryId} className="bg-[var(--paper-2)] p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[color:var(--ink)] text-lg">{nomPays(countryId)}</div>
                  <div className="text-sm text-[color:var(--muted)] mt-1">
                    {s.statut} <span className={`font-medium ${req.status === 'approved' ? 'text-[color:var(--accent-deep)]' : 'text-[color:var(--cta-orange-deep)]'}`}>
                      {req.status === 'approved' ? s.valide : s.enAttenteEtat}
                    </span>
                  </div>
                  {req.extendedUntil && (
                    <div className="text-xs text-[color:var(--muted)] mt-1">{s.jusquAu(formatAbsolute(req.extendedUntil, lang))}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  {[60, 180, 720].map((m) => (
                    <button key={m} type="button" onClick={() => handleApprove(countryId, m)} title={apres(m, req)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-v-accent/10 text-[color:var(--accent-deep)] hover:bg-v-accent/20 flex flex-col items-center leading-tight">
                      <span>+ {m / 60} h</span><span className="text-[11px] font-medium opacity-80">{apres(m, req)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
