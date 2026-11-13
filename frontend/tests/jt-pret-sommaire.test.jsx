import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { composerJT } from '../src/components/editor/gabaritJT.js';
import { LIBELLE_ANNONCES, LIBELLE_SEMINAIRES } from '../src/components/editor/rubriquesAuto.js';
import { computeTimelineLayout } from '../src/components/editor/timelineModel.js';
import { sommaireDuJT } from '../src/components/editor/sommaireJT.js';
import { minutage, texteDuSommaire, chapitreEnCours, avanceeDansChapitre } from '../src/lib/sommaire.js';
import LecteurJT from '../src/components/LecteurJT.jsx';
import JTPretJournaliste from '../src/components/JTPretJournaliste.jsx';
import ExportStatus from '../src/components/editor/ExportStatus.jsx';
import EtatLivraison from '../src/components/EtatLivraison.jsx';

// LE BESOIN : un JT de trente minutes se regarde rarement d'une traite sur un
// téléphone. Le correspondant veut aller droit à son reportage, en données
// mobiles ; la rédaction veut publier sur YouTube et Facebook avec des
// chapitres. Le déroulé sait déjà où commence chaque partie.

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

const NOMS = { cmr: 'Cameroun', gab: 'Gabon', sn: 'Sénégal' };
const f = (filename, countryId, reportage, extra = {}) => ({
  filename, name: filename, countryId, reportage, status: 'pending', uploadedAt: '2026-11-10T10:00:00Z', ...extra,
});
const jingle = (categorie) => ({ id: `j-${categorie}`, filename: `jingle-${categorie}.mp4`, name: `Jingle ${categorie}`, categorie });
const JINGLES = ['generique', 'reportages', 'annonces', 'seminaires', 'mot'].map(jingle);
const versClip = (x) => ({ ...x, instanceId: `i-${x.filename}`, overlays: [], durationSec: 30, sourceDurationSec: 30 });
const journal = (jingles = JINGLES) => {
  let n = 0;
  return composerJT({
    nomPays: (id) => NOMS[id] || id,
    versClip,
    creerId: (k = 'x') => `${k}-${++n}`,
    jingles,
    videos: [
      f('gab-r1.mp4', 'gab', 'Marché', { sujetId: 's-gab' }),
      f('cmr-r1.mp4', 'cmr', 'Pêche', { sujetId: 's-cmr' }),
      f('cmr-a1.mp4', 'cmr', LIBELLE_ANNONCES),
      f('sn-s1.mp4', 'sn', LIBELLE_SEMINAIRES),
      f('mot.mp4', 'mj', ''),
    ],
    sujets: [
      { id: 's-cmr', countryId: 'cmr', titre: 'La pêche reprend à Kribi' },
      { id: 's-gab', countryId: 'gab', titre: 'Le marché de Mont-Bouët' },
    ],
  });
};

describe('le sommaire du JT, tiré du déroulé', () => {
  it('nomme chaque partie, dans l’ordre du journal, au bon instant', () => {
    const { clips, overlays } = journal();
    const sommaire = sommaireDuJT({ clips, overlays, jingles: JINGLES });
    expect(sommaire.map((c) => c.titre)).toEqual([
      'Générique',
      'Les titres',
      'La pêche reprend à Kribi — Cameroun',
      'Le marché de Mont-Bouët — Gabon',
      'Annonces',
      'Séminaires',
      'Le mot du JT',
    ]);
    // Le reportage commence là où son premier plan commence.
    const layout = computeTimelineLayout(clips);
    const debutGabon = layout.items.find((i) => i.clip.filename === 'gab-r1.mp4').start;
    expect(sommaire.find((c) => c.titre.startsWith('Le marché')).t).toBeCloseTo(debutGabon, 1);
    expect(sommaire[0].t).toBe(0);
  });

  it('retrouve une rubrique posée sans son jingle par le bandeau du premier pays', () => {
    const sansRubriques = JINGLES.filter((j) => j.categorie !== 'annonces' && j.categorie !== 'seminaires');
    const { clips, overlays } = journal(sansRubriques);
    const titres = sommaireDuJT({ clips, overlays, jingles: sansRubriques }).map((c) => c.titre);
    expect(titres).toContain('Annonces');
    expect(titres).toContain('Séminaires');
  });

  it('commence toujours à 0:00, même quand le journal ne s’ouvre pas sur une partie connue', () => {
    // Un plateau sans titre, puis un reportage titré.
    const clips = [
      { instanceId: 'p', filename: 'plateau.mp4', durationSec: 20, sourceDurationSec: 20, overlays: [] },
      { instanceId: 'r', filename: 'r.mp4', durationSec: 30, sourceDurationSec: 30, overlays: [{ templateId: 'titre_reportage', startTime: 0, fields: { titre: 'La rentrée à Libreville', sous_titre: 'Gabon' } }] },
    ];
    const sommaire = sommaireDuJT({ clips, overlays: [], jingles: [] });
    expect(sommaire).toEqual([{ t: 0, titre: 'Ouverture' }, { t: 20, titre: 'La rentrée à Libreville — Gabon' }]);
    expect(sommaireDuJT({ clips: [], overlays: [], jingles: [] })).toEqual([]);
  });
});

describe('le sommaire à coller sur YouTube ou Facebook', () => {
  // L'INCIDENT évité : YouTube ignore TOUT le sommaire si une partie dure
  // moins de 10 secondes, ou si le premier repère n'est pas à 0:00.
  it('fond une partie trop courte dans la suivante et garde 0:00 en tête', () => {
    const texte = texteDuSommaire([
      { t: 0, titre: 'Générique' },
      { t: 38, titre: 'Les titres' },
      { t: 44, titre: 'La pêche reprend à Kribi' },
      { t: 252, titre: 'Le marché de Mont-Bouët' },
      { t: 3725, titre: 'Le mot du JT' },
    ]);
    expect(texte).toBe('0:00 Générique\n0:44 La pêche reprend à Kribi\n4:12 Le marché de Mont-Bouët\n1:02:05 Le mot du JT');
  });

  it('dit l’heure comme les plateformes la lisent', () => {
    expect(minutage(0)).toBe('0:00');
    expect(minutage(65.9)).toBe('1:05');
    expect(minutage(3600)).toBe('1:00:00');
  });

  it('sait quelle partie est en cours, et où on en est', () => {
    const c = [{ t: 0, titre: 'a' }, { t: 60, titre: 'b' }, { t: 120, titre: 'c' }];
    expect(chapitreEnCours(c, 0)).toBe(0);
    expect(chapitreEnCours(c, 90)).toBe(1);
    expect(chapitreEnCours(c, 500)).toBe(2);
    expect(avanceeDansChapitre(c, 1, 90, 180)).toBe(0.5);
    expect(avanceeDansChapitre(c, 2, 150, 180)).toBe(0.5);
  });
});

const JT = {
  id: 'j1',
  name: 'JT ALWM - Semaine 46 (2026).mp4',
  filename: 'master.mp4',
  type: 'video',
  size: '450.0 MB',
  uploadedAt: '2026-11-13T10:00:00.000Z',
  leger: { statut: 'pret', filename: 'master.leger.mp4', size: '85.0 MB' },
  sommaire: [
    { t: 0, titre: 'Générique' },
    { t: 44, titre: 'La pêche reprend à Kribi — Cameroun' },
    { t: 252, titre: 'Le marché de Mont-Bouët — Gabon' },
  ],
};

describe('le lecteur du JT publié', () => {
  it('saute à la partie touchée et la marque comme en cours', () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    render(<I18nProvider><LecteurJT fichier={JT} onFermer={vi.fn()} /></I18nProvider>);
    const video = document.querySelector('video');
    fireEvent.click(screen.getByRole('button', { name: 'Aller à 4:12 : Le marché de Mont-Bouët — Gabon' }));
    expect(video.currentTime).toBe(252);
    expect(play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Le marché de Mont-Bouët/ })).toHaveAttribute('aria-current', 'true');
    play.mockRestore();
  });

  it('lit la version téléphone d’abord côté correspondants, et passe en qualité TV à la demande', () => {
    render(<I18nProvider><LecteurJT fichier={JT} prefererLeger onFermer={vi.fn()} /></I18nProvider>);
    expect(document.querySelector('video').getAttribute('src')).toMatch(/master\.leger\.mp4$/);
    fireEvent.click(screen.getByRole('button', { name: 'Lire en qualité TV' }));
    expect(document.querySelector('video').getAttribute('src')).toMatch(/\/master\.mp4$/);
  });

  it('se ferme à Échap', () => {
    const fermer = vi.fn();
    render(<I18nProvider><LecteurJT fichier={JT} onFermer={fermer} /></I18nProvider>);
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
    expect(fermer).toHaveBeenCalled();
  });
});

const carte = (livraison, onRegarder = vi.fn()) => render(
  <I18nProvider>
    <JTPretJournaliste
      weeks={[{ id: '2026-W46', status: 'active' }]}
      selectedWeek="2026-W46"
      setSelectedWeek={vi.fn()}
      livraisons={[livraison]}
      chargement={false}
      onRegarder={onRegarder}
    />
  </I18nProvider>,
);

describe('le JT prêt sur un téléphone', () => {
  it('propose la version téléphone d’abord, et garde la qualité TV pour diffuser', () => {
    carte(JT);
    const leger = screen.getByRole('link', { name: /version téléphone/ });
    expect(leger.getAttribute('href')).toMatch(/master\.leger\.mp4\?dl=1$/);
    expect(screen.getByText('Version téléphone (85.0 MB)')).toBeInTheDocument();
    expect(screen.getByText('Conseillée en données mobiles')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /qualité TV/ }).getAttribute('href')).toMatch(/\/master\.mp4\?dl=1$/);
  });

  it('dit que la version téléphone se prépare, sans cacher le master', () => {
    carte({ ...JT, leger: { statut: 'en_cours' } });
    expect(screen.getByText(/se prépare/)).toBeInTheDocument();
    expect(screen.getByText('Télécharger le JT (450.0 MB)')).toBeInTheDocument();
  });

  it('ouvre le lecteur à la partie touchée dans le sommaire', () => {
    const onRegarder = vi.fn();
    carte(JT, onRegarder);
    fireEvent.click(screen.getByRole('button', { name: 'Regarder à partir de 0:44 : La pêche reprend à Kribi — Cameroun' }));
    expect(onRegarder).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }), 44);
  });

  it('replie un long sommaire, et le déplie d’un geste', () => {
    const long = Array.from({ length: 9 }, (_, i) => ({ t: i * 60, titre: `Partie ${i + 1}` }));
    carte({ ...JT, sommaire: long });
    expect(screen.queryByText('Partie 9')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 9 parties' }));
    expect(screen.getByText('Partie 9')).toBeInTheDocument();
  });
});

describe('publier le master depuis le studio', () => {
  it('offre « Publier dans JT Prêt » quand le master est rendu, puis dit qu’il est publié', () => {
    const onPublier = vi.fn();
    const { rerender } = render(<I18nProvider><ExportStatus urlVideo="/uploads/exports/export_1.mp4" onPublier={onPublier} /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Publier dans JT Prêt' }));
    expect(onPublier).toHaveBeenCalled();
    rerender(<I18nProvider><ExportStatus urlVideo="/uploads/exports/export_1.mp4" onPublier={onPublier} publie /></I18nProvider>);
    expect(screen.queryByRole('button', { name: 'Publier dans JT Prêt' })).toBeNull();
    expect(screen.getByText('Publié dans JT Prêt')).toBeInTheDocument();
  });

  it('copie le sommaire au format des chapitres YouTube', async () => {
    const ecrire = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    render(<I18nProvider><ToastProvider><EtatLivraison fichier={JT} /></ToastProvider></I18nProvider>);
    expect(screen.getByText('Version téléphone prête (85.0 MB)')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copier pour YouTube/ })); });
    expect(ecrire).toHaveBeenCalledWith('0:00 Générique\n0:44 La pêche reprend à Kribi — Cameroun\n4:12 Le marché de Mont-Bouët — Gabon');
  });
});
