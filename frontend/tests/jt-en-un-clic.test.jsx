import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { composerJT, dureeTitres, planCarton, reportagesDeLaSemaine, LIBELLE_ASSEMBLE } from '../src/components/editor/gabaritJT.js';
import { LIBELLE_ANNONCES, LIBELLE_SEMINAIRES, TRANSITION_ENTRE_PAYS } from '../src/components/editor/rubriquesAuto.js';
import { controlerJT, aCorriger } from '../src/components/editor/controleJT.js';
import ControleGeneration from '../src/components/editor/ControleGeneration.jsx';
import { previewUrl } from '../src/lib/mediaSource.js';
import { CARTON, estCarton } from '../../remotion/src/plans.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

// LE CONSTAT : même avec les rubriques automatiques, le monteur reconstruisait
// à la main la charpente de chaque JT — générique, « Les titres » réécrits,
// chaque reportage et son titre, la virgule, le jingle avant chaque rubrique,
// la fin. Toujours la même. Le gabarit la pose d'un coup.

const NOMS = { cmr: 'Cameroun', gab: 'Gabon', sn: 'Sénégal' };
const nomPays = (id) => NOMS[id] || id;
const f = (filename, countryId, reportage, extra = {}) => ({
  filename, name: filename, countryId, reportage, status: 'pending', uploadedAt: '2026-11-10T10:00:00Z', ...extra,
});
const jingle = (categorie) => ({ id: `j-${categorie}`, filename: `jingle-${categorie}.mp4`, name: `Jingle ${categorie}`, categorie });
const versClip = (x) => ({ ...x, instanceId: `i-${x.filename}`, overlays: [], durationSec: 10, sourceDurationSec: 10 });
const poser = (args = {}) => {
  let n = 0;
  return composerJT({ nomPays, versClip, creerId: (k = 'x') => `${k}-${++n}`, ...args });
};
const TOUS_LES_JINGLES = ['generique', 'reportages', 'annonces', 'seminaires', 'mot'].map(jingle);

describe('le JT en un clic — la charpente', () => {
  const videos = [
    f('gab-r1.mp4', 'gab', 'Marché', { sujetId: 's-gab' }),
    f('cmr-r1.mp4', 'cmr', 'Pêche', { sujetId: 's-cmr' }),
    f('cmr-a1.mp4', 'cmr', LIBELLE_ANNONCES),
    f('sn-s1.mp4', 'sn', LIBELLE_SEMINAIRES),
    f('mot.mp4', 'mj', ''),
  ];
  const sujets = [{ id: 's-cmr', countryId: 'cmr', titre: 'La pêche reprend à Kribi' }, { id: 's-gab', countryId: 'gab', titre: 'Le marché de Mont-Bouët' }];

  it('pose tout le journal dans l’ordre du gabarit', () => {
    const { clips } = poser({ videos, sujets, jingles: TOUS_LES_JINGLES, motDuJt: { orateur: 'Aminata Diallo', theme: 'Le budget' } });
    expect(clips.map((c) => (estCarton(c) ? `[${c.name}]` : c.filename))).toEqual([
      'jingle-generique.mp4',
      '[Les titres]',
      'cmr-r1.mp4',
      'jingle-reportages.mp4',
      'gab-r1.mp4',
      'jingle-annonces.mp4',
      'cmr-a1.mp4',
      'jingle-seminaires.mp4',
      'sn-s1.mp4',
      'jingle-mot.mp4',
      'mot.mp4',
      '[Fin du JT]',
    ]);
  });

  it('écrit « Les titres » avec les titres des sujets, dans l’ordre où ils passeront', () => {
    const { clips } = poser({ videos, sujets, jingles: TOUS_LES_JINGLES });
    const titres = clips.find((c) => c.name === 'Les titres');
    expect(titres.overlays[0]).toMatchObject({ templateId: 'rappel_titres', fields: { titre1: 'La pêche reprend à Kribi', titre2: 'Le marché de Mont-Bouët' } });
    expect(titres.durationSec).toBe(dureeTitres(2));
  });

  it('titre chaque reportage, et identifie le pays des annonces tout du long', () => {
    const { overlays } = poser({ videos, sujets, jingles: TOUS_LES_JINGLES, motDuJt: { orateur: 'Aminata Diallo', theme: 'Le budget' } });
    expect(overlays.filter((o) => o.templateId === 'titre_reportage').map((o) => o.fields)).toEqual([
      { titre: 'La pêche reprend à Kribi', sous_titre: 'Cameroun' },
      { titre: 'Le marché de Mont-Bouët', sous_titre: 'Gabon' },
    ]);
    expect(overlays.find((o) => o.templateId === 'mention_image').fields.texte).toBe(`Cameroun · ${LIBELLE_ANNONCES}`);
    expect(overlays.find((o) => o.templateId === 'nom_interview').fields).toEqual({ nom: 'Aminata Diallo', fonction: 'Le budget' });
  });

  it('ne met pas de transition contre un jingle ou un carton, mais entre deux pays d’une rubrique', () => {
    const { clips } = poser({ videos: [f('cmr-a.mp4', 'cmr', LIBELLE_ANNONCES), f('gab-a.mp4', 'gab', LIBELLE_ANNONCES)], jingles: [jingle('annonces')] });
    expect(clips.map((c) => c.filename)).toEqual(['jingle-annonces.mp4', 'cmr-a.mp4', 'gab-a.mp4', CARTON]);
    expect(clips[0].transition).toBeUndefined();
    expect(clips[1].transition).toEqual(TRANSITION_ENTRE_PAYS);
    expect(clips[2].transition).toBeUndefined();
  });

  it('dit quels jingles manquent, et monte quand même', () => {
    const { clips, bilan } = poser({ videos: [f('cmr-r1.mp4', 'cmr', 'Pêche'), f('gab-r1.mp4', 'gab', 'Marché')], jingles: [] });
    expect(bilan.sansJingle).toEqual(['generique', 'reportages']);
    expect(clips.filter((c) => !estCarton(c)).map((c) => c.filename)).toEqual(['cmr-r1.mp4', 'gab-r1.mp4']);
    // Sans virgule, deux reportages s'enchaînent par la transition de la chaîne.
    expect(clips[1].transition).toEqual(TRANSITION_ENTRE_PAYS);
  });

  it('ne reprend ni un rush refusé, ni un tiroir du JT, ni une image', () => {
    const { clips } = poser({ videos: [f('a.mp4', 'cmr', 'Pêche', { status: 'rejected' }), f('b.mp4', 'tj', 'Conducteur'), f('c.jpg', 'cmr', 'Pêche'), f('d.mp4', 'cmr', 'Pêche')] });
    expect(clips.filter((c) => !estCarton(c)).map((c) => c.filename)).toEqual(['d.mp4']);
  });

  it('prend le reportage assemblé par la rédaction à la place des rushes bruts du pays', () => {
    const reportages = reportagesDeLaSemaine([
      f('cmr-brut1.mp4', 'cmr', 'Pêche'), f('cmr-brut2.mp4', 'cmr', 'Pêche'), f('cmr-fini.mp4', 'cmr', LIBELLE_ASSEMBLE),
      f('gab-brut.mp4', 'gab', 'Marché'),
    ], [], nomPays);
    expect(reportages.map((r) => r.fichiers.map((x) => x.filename))).toEqual([['cmr-fini.mp4'], ['gab-brut.mp4']]);
  });

  it('ne pose rien quand rien n’a été reçu, pas même le générique', () => {
    expect(poser({ videos: [], jingles: TOUS_LES_JINGLES }).clips).toEqual([]);
  });
});

describe('le carton — un plan sans vidéo', () => {
  it('n’a pas de fichier, et se rallonge sur la timeline', () => {
    const carton = planCarton({ id: 'c1', nom: 'Les titres', duree: 6 });
    expect(estCarton(carton)).toBe(true);
    expect(carton).toMatchObject({ inPoint: 0, outPoint: 6, durationSec: 6 });
    expect(carton.sourceDurationSec).toBeGreaterThan(60);
    expect(previewUrl(carton)).toBe('');
  });
});

// LE CONSTAT : la seule vérification portait sur les fichiers manquants, côté
// serveur. Le reste se découvrait en regardant le master, deux heures après.
describe('le contrôle avant génération', () => {
  const plan = (n, extra = {}) => ({ instanceId: `p${n}`, filename: `r${n}.mp4`, name: `Plan ${n}`, inPoint: 0, outPoint: 10, durationSec: 10, overlays: [], ...extra });
  const fichiers = [1, 2, 3].map((n) => ({ filename: `r${n}.mp4`, status: 'pending' }));
  const codes = (args) => controlerJT({ fichiers, ...args }).map((r) => r.code);

  it('ne dit rien d’un montage en ordre', () => {
    expect(controlerJT({ clips: [plan(1), plan(2)], fichiers })).toEqual([]);
  });

  it('signale un déroulé vide', () => {
    expect(codes({ clips: [] })).toEqual(['vide']);
  });

  it('signale un rush refusé resté au déroulé, et un fichier disparu', () => {
    const remarques = controlerJT({ clips: [plan(1), plan(9)], fichiers: [{ filename: 'r1.mp4', status: 'rejected' }] });
    expect(remarques.map((r) => [r.code, r.rang])).toEqual([['refuse', 1], ['introuvable', 2]]);
    expect(aCorriger(remarques)).toBe(true);
  });

  it('signale un plan de moins d’une seconde, sans l’imposer', () => {
    const remarques = controlerJT({ clips: [plan(1, { outPoint: 0.5 })], fichiers });
    expect(remarques.map((r) => [r.code, r.gravite])).toEqual([['court', 'conseil']]);
    expect(aCorriger(remarques)).toBe(false);
  });

  it('signale un habillage sans texte, qui ne s’afficherait pas', () => {
    expect(codes({ clips: [plan(1, { overlays: [{ templateId: 'nom_interview', fields: { nom: ' ' } }] })] })).toEqual(['texteVide']);
    expect(codes({ clips: [plan(1)], overlays: [{ templateId: 'rappel_titres', fields: {}, startTime: 0, duration: 4 }] })).toEqual(['titreVide']);
  });

  it('signale deux titres l’un sur l’autre, mais pas un titre sur la mention du pays', () => {
    const titre = (startTime, templateId = 'titre_reportage') => ({ templateId, fields: { titre: 'x', texte: 'x' }, startTime, duration: 5 });
    expect(codes({ clips: [plan(1), plan(2)], overlays: [titre(0), titre(3)] })).toEqual(['chevauchement']);
    expect(codes({ clips: [plan(1), plan(2)], overlays: [titre(0, 'mention_image'), titre(1)] })).toEqual([]);
  });

  it('compare la durée à la durée visée, à 10 % près', () => {
    expect(codes({ clips: [plan(1), plan(2)], dureeCible: 1 })).toEqual(['duree']);
    expect(codes({ clips: [plan(1), plan(2), plan(3)], dureeCible: 0.5 })).toEqual([]);
  });

  it('rappelle le générique enregistré mais absent du déroulé', () => {
    expect(codes({ clips: [plan(1)], jingles: [{ categorie: 'generique', filename: 'g.mp4' }] })).toEqual(['sansGenerique']);
  });

  it('ne réclame pas de fichier pour un carton', () => {
    expect(codes({ clips: [planCarton({ id: 'c', nom: 'Fin', duree: 5 })] })).toEqual([]);
  });
});

describe('la fenêtre du contrôle', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

  it('mène au plan concerné, et laisse générer quand même', () => {
    const onAller = vi.fn();
    const onGenerer = vi.fn();
    const remarques = [{ code: 'refuse', gravite: 'important', planId: 'p1', rang: 1, instant: 0, valeurs: { nom: 'Plan 1' } }];
    render(<I18nProvider><ControleGeneration remarques={remarques} dureeCible={null} onDureeCible={() => {}} onAller={onAller} onGenerer={onGenerer} onFermer={() => {}} /></I18nProvider>);
    expect(screen.getByRole('dialog', { name: 'Avant de générer le JT' })).toBeInTheDocument();
    expect(screen.getByText(/« Plan 1 » a été refusé/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(onAller).toHaveBeenCalledWith(remarques[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Générer quand même' }));
    expect(onGenerer).toHaveBeenCalledTimes(1);
  });

  it('règle la durée visée', () => {
    const onDureeCible = vi.fn();
    render(<I18nProvider><ControleGeneration remarques={[{ code: 'court', gravite: 'conseil', valeurs: { nom: 'x', duree: 0.5 } }]} dureeCible={26} onDureeCible={onDureeCible} onAller={() => {}} onGenerer={() => {}} onFermer={() => {}} /></I18nProvider>);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Durée visée du JT' }), { target: { value: '30' } });
    expect(onDureeCible).toHaveBeenCalledWith(30);
    expect(screen.getByRole('button', { name: 'Générer le JT' })).toBeInTheDocument();
  });
});
