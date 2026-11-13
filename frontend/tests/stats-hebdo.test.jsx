import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import StatsView from '../src/components/StatsView.jsx';
import { api } from '../src/api/index.js';
import { indicateurs, participation, parPays, motifsDeLaPeriode, versCSV, estTerminee } from '../src/lib/statsHebdo.js';
import { accuserJT, paysDeLAppareil, memoriserPaysSession } from '../src/lib/accuseJT.js';

// LE BESOIN : la page ne savait que cumuler depuis toujours, sans dire si la
// semaine écoulée allait mieux que les précédentes. Elle montre maintenant
// douze semaines : tendance, participation, chaque pays, les motifs de refus.

const bilan = (n, total, pays = {}, extra = {}) => ({
  weekId: `2026-w${n}`,
  cutoffAt: new Date(Date.UTC(2026, 0, 1) + n * 7 * 86400000).toISOString(),
  total: { paysAttendus: 4, paysActifs: 0, aLHeure: 0, enRetard: 0, refuses: 0, delaisDemandes: 0, delaisAccordes: 0, octets: 0, gainOctets: 0, vues: 0, telechargements: 0, ...total },
  pays,
  motifs: [],
  jt: null,
  ...extra,
});

// Du plus récent au plus ancien, comme le serveur les envoie. La 46 n'est pas finie.
const SEMAINES = [
  bilan(46, { paysActifs: 1, aLHeure: 1 }, { cm: { fichiers: 2, enRetard: 0 } }, { cutoffAt: '2099-01-01T00:00:00Z' }),
  bilan(45, { paysActifs: 3, aLHeure: 2, enRetard: 1, refuses: 2, delaisDemandes: 2, delaisAccordes: 1, octets: 2 * 1024 ** 3, gainOctets: 512 * 1024 ** 2, vues: 9, telechargements: 3 },
    { cm: { fichiers: 4, enRetard: 0, refuses: 1, vues: 6, telechargements: 2, sujets: 2, diffuses: 1 }, sn: { fichiers: 2, enRetard: 1, delai: 'accorde', refuses: 1, vues: 3, telechargements: 1 }, ga: { fichiers: 1, enRetard: 0 } },
    { motifs: [{ texte: 'Son inaudible', n: 2 }], jt: { publieLe: '2026-11-08T20:00:00Z', apresClotureMin: 700, dureeSec: 1790 } }),
  bilan(44, { paysActifs: 2, aLHeure: 2 }, { cm: { fichiers: 3, enRetard: 0 }, ga: { fichiers: 1, enRetard: 0 } }, { motifs: [{ texte: 'Son inaudible', n: 1 }, { texte: 'Image floue', n: 1 }] }),
];

describe('les statistiques, calculées', () => {
  it('lit la dernière semaine terminée, pas celle en cours', () => {
    expect(estTerminee(SEMAINES[0])).toBe(false);
    const ind = indicateurs(SEMAINES);
    expect(ind.semaine).toBe('2026-w45');
    expect(ind.participation.valeur).toBe(75);
    expect(ind.aLHeure.valeur).toBe(67);
    expect(ind.publication.valeur).toBe(700);
    expect(ind.vues.valeur).toBe(12);
    // La courbe va de l'ancienne à la récente.
    expect(ind.participation.serie.map((p) => p.valeur)).toEqual([50, 75]);
  });

  it('partage chaque semaine en à l’heure, en retard et rien reçu', () => {
    expect(participation(SEMAINES).map((c) => [c.numero, c.aLHeure, c.enRetard, c.absents])).toEqual([[44, 2, 0, 2], [45, 2, 1, 1], [46, 1, 0, 3]]);
  });

  it('donne à chaque pays ses cases, semaine par semaine', () => {
    const lignes = parPays(SEMAINES, ['cm', 'sn', 'ga', 'ci']);
    const cm = lignes.find((l) => l.id === 'cm');
    expect(cm.cases.map((c) => c.etat)).toEqual(['aLHeure', 'aLHeure', 'aLHeure']);
    expect(lignes.find((l) => l.id === 'sn').cases.map((c) => c.etat)).toEqual(['absent', 'enRetard', 'absent']);
    expect(lignes.find((l) => l.id === 'ci').actives).toBe(0);
    expect(cm).toMatchObject({ refuses: 1, vues: 8, sujets: 2, diffuses: 1 });
  });

  it('cumule les motifs de refus de la période', () => {
    expect(motifsDeLaPeriode(SEMAINES)).toEqual([{ texte: 'Son inaudible', n: 3 }, { texte: 'Image floue', n: 1 }]);
  });

  // L'INCIDENT évité : une cellule qui commence par « = » s'exécute comme une
  // formule à l'ouverture dans un tableur.
  it('exporte pour un tableur français, sans formule exécutable', () => {
    const csv = versCSV([bilan(45, {}, { cm: { fichiers: 1, enRetard: 0, refuses: 0, octets: 3 * 1024 * 1024 } })], () => '=HYPERLINK("x")', ['Semaine', 'Pays', 'Fichiers', 'En retard', 'Refusés', 'Délai', 'Reportages', 'Diffusés', 'Lectures', 'Téléchargements', 'Mo']);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [entete, ligne] = csv.slice(1).trim().split('\r\n');
    expect(entete.split(';')).toHaveLength(11);
    expect(ligne).toBe('2026-w45;"\'=HYPERLINK(""x"")";1;0;0;;;;;;3');
  });
});

describe('la page des statistiques', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    sessionStorage.setItem('jt-admin-pass', 'secret');
    vi.restoreAllMocks();
    vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);
    vi.spyOn(api, 'getStats').mockResolvedValue({ delaysByWeek: {}, semaines: SEMAINES, paysAttendus: ['cm', 'sn', 'ga', 'ci'] });
  });
  const monter = () => render(
    <I18nProvider>
      <StatsView
        weeks={[{ id: '2026-w46', status: 'active', cutoffAt: '2099-01-01T00:00:00Z' }]}
        selectedWeek="2026-w46"
        countries={[{ id: 'cm', name: 'Cameroun' }, { id: 'sn', name: 'Sénégal' }, { id: 'ga', name: 'Gabon' }, { id: 'ci', name: 'Côte d’Ivoire' }]}
      />
    </I18nProvider>,
  );

  it('montre les indicateurs de la dernière semaine terminée', async () => {
    monter();
    expect(await screen.findByText('75 %')).toBeInTheDocument();
    expect(screen.getByText('+11 h 40')).toBeInTheDocument();
    expect(screen.getByText('29 min 50')).toBeInTheDocument();
    expect(screen.getByText('512 Mo gagnés par l’allègement')).toBeInTheDocument();
  });

  it('dit chaque colonne en clair, au clavier comme au survol', async () => {
    monter();
    const colonne = await screen.findByRole('listitem', { name: 'Semaine 45 : 2 pays à l’heure, 1 en retard, 1 sans envoi' });
    fireEvent.focus(colonne);
    expect(within(colonne).getByRole('tooltip')).toHaveTextContent('Sem. 45');
  });

  it('ouvre la fiche d’un pays, semaine par semaine', async () => {
    monter();
    fireEvent.click(await screen.findByRole('button', { name: 'Sénégal' }));
    const fiche = screen.getByRole('table', { name: 'Fiche de Sénégal, semaine par semaine' });
    expect(within(fiche).getByText('accordé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sénégal' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('exporte la période en CSV', async () => {
    const creer = vi.fn(() => 'blob:stats');
    URL.createObjectURL = creer;
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    monter();
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter (CSV)' }));
    expect(creer).toHaveBeenCalled();
    expect(clic).toHaveBeenCalled();
  });
});

describe('les vues du JT — un accusé par appareil, le pays seul', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('n’envoie qu’une fois par JT et par geste, avec le pays de l’onglet', () => {
    const envoi = vi.spyOn(api, 'signalerVueJT').mockResolvedValue(null);
    memoriserPaysSession('cm');
    expect(accuserJT('2026-w46', { id: 'jt1' }, 'lecture')).toBe(true);
    expect(accuserJT('2026-w46', { id: 'jt1' }, 'lecture')).toBe(false);
    accuserJT('2026-w46', { id: 'jt1' }, 'telechargement');
    expect(envoi.mock.calls).toEqual([['2026-w46', 'jt1', 'cm', 'lecture'], ['2026-w46', 'jt1', 'cm', 'telechargement']]);
  });

  it('reconnaît le pays d’un appareil qui n’en sert qu’un, et sinon ne devine pas', () => {
    localStorage.setItem('uploader_phone_sn', '+221771234567');
    expect(paysDeLAppareil()).toBe('sn');
    localStorage.setItem('uploader_phone_cm', '+237671234567');
    expect(paysDeLAppareil()).toBe('');
  });
});
