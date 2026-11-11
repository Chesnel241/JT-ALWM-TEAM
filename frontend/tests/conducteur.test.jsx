import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  deplacer, deroule, dupliquer, dureeParlee, inserer, instant, planALInstant, rangerRushes, retirer,
} from '../src/components/editor/conducteur.js';
import { Deroule, RushesStudio } from '../src/components/editor/Conducteur.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

const plan = (n, extra = {}) => ({ instanceId: `p${n}`, filename: `r${n}.mp4`, name: `Plan ${n}`, inPoint: 0, outPoint: 10, ...extra });

// LE CONSTAT : le studio était une table de montage de professionnel, et les
// rushes vivaient dans un autre onglet. L'outil n'a jamais vraiment servi.
// Le déroulé est la liste des plans, dans l'ordre de diffusion.
describe('le déroulé du JT — le calcul', () => {
  it('donne à chaque plan son rang, son début et sa durée', () => {
    const { plans, total } = deroule([plan(1), plan(2, { outPoint: 4 }), plan(3)]);
    expect(plans.map((p) => [p.rang, p.debut, p.duree])).toEqual([[1, 0, 10], [2, 10, 4], [3, 14, 10]]);
    expect(total).toBe(24);
  });

  it('un fondu raccourcit le JT d’autant, comme au rendu', () => {
    const { plans, total } = deroule([plan(1, { transition: { type: 'fade', duration: 1 } }), plan(2)]);
    expect(plans[1].debut).toBe(9);
    expect(total).toBe(19);
  });

  it('dit les durées comme on les dit', () => {
    expect(dureeParlee(45)).toBe('45 s');
    expect(dureeParlee(80)).toBe('1 min 20');
    expect(dureeParlee(120)).toBe('2 min');
    expect(dureeParlee(3840)).toBe('1 h 04 min');
    expect(instant(7)).toBe('0:07');
    expect(instant(3725)).toBe('1:02:05');
  });

  it('retrouve le plan qui passe à l’écran', () => {
    const { plans } = deroule([plan(1), plan(2), plan(3)]);
    expect(planALInstant(plans, 0).rang).toBe(1);
    expect(planALInstant(plans, 10).rang).toBe(2);
    expect(planALInstant(plans, 29.9).rang).toBe(3);
  });

  it('déplace, duplique et retire sans toucher aux autres plans', () => {
    const liste = [plan(1), plan(2), plan(3)];
    expect(deplacer(liste, 'p3', { pas: -1 }).map((c) => c.instanceId)).toEqual(['p1', 'p3', 'p2']);
    expect(deplacer(liste, 'p1', { vers: 2 }).map((c) => c.instanceId)).toEqual(['p2', 'p3', 'p1']);
    expect(deplacer(liste, 'p1', { pas: -1 })).toBe(liste); // déjà en tête : rien ne change
    expect(dupliquer(liste, 'p2', 'copie').map((c) => c.instanceId)).toEqual(['p1', 'p2', 'copie', 'p3']);
    expect(retirer(liste, 'p2').map((c) => c.instanceId)).toEqual(['p1', 'p3']);
    expect(retirer(liste, 'inconnu')).toBe(liste);
  });

  // Dans un JT de deux cents plans, le rush ajouté doit arriver là où le
  // monteur regarde, pas tout au bout.
  it('un rush ajouté se place après le plan choisi, sinon à la fin', () => {
    const liste = [plan(1), plan(2), plan(3)];
    expect(inserer(liste, plan(9), 'p1').map((c) => c.instanceId)).toEqual(['p1', 'p9', 'p2', 'p3']);
    expect(inserer(liste, plan(9), null).map((c) => c.instanceId)).toEqual(['p1', 'p2', 'p3', 'p9']);
    expect(inserer(liste, plan(9), 'disparu').at(-1).instanceId).toBe('p9');
  });

  it('range les rushes par pays puis par reportage, et compte leurs emplois', () => {
    const videos = [
      { filename: 'a.mp4', name: 'interview', countryId: 'sn', reportage: 'Pêche à Dakar', status: 'approved' },
      { filename: 'b.mp4', name: 'marché', countryId: 'cm', reportage: 'Mokolo', status: 'pending' },
      { filename: 'c.mp4', name: 'plateau', countryId: 'cm', reportage: 'Mokolo', status: 'rejected' },
    ];
    const noms = { sn: 'Sénégal', cm: 'Cameroun' };
    const groupes = rangerRushes(videos, [{ filename: 'a.mp4' }, { filename: 'a.mp4' }], { nomPays: (id) => noms[id] });
    expect(groupes.map((g) => g.nom)).toEqual(['Cameroun', 'Sénégal']);
    expect(groupes[0].nombre).toBe(1); // le rush refusé n'est pas proposé
    expect(groupes[1].reportages[0].rushes[0].emplois).toBe(2);
  });

  it('la recherche ignore les accents et les majuscules', () => {
    const videos = [
      { filename: 'a.mp4', name: 'interview', countryId: 'sn', reportage: 'Pêche à Dakar' },
      { filename: 'b.mp4', name: 'marché', countryId: 'cm', reportage: 'Mokolo' },
    ];
    const noms = { sn: 'Sénégal', cm: 'Cameroun' };
    expect(rangerRushes(videos, [], { nomPays: (id) => noms[id], recherche: 'SENEGAL' }).map((g) => g.id)).toEqual(['sn']);
    expect(rangerRushes(videos, [], { nomPays: (id) => noms[id], recherche: 'peche' }).map((g) => g.id)).toEqual(['sn']);
    expect(rangerRushes(videos, [], { nomPays: (id) => noms[id], recherche: 'zzz' })).toEqual([]);
  });
});

describe('le déroulé du JT — l’écran', () => {
  const pays = [{ id: 'cm', name: 'Cameroun' }];
  const monter = (clips, extra = {}) => {
    const etat = { clips };
    const modifierMontage = vi.fn((maj) => { Object.assign(etat, maj(etat)); });
    const onChoisir = vi.fn();
    const vue = (choisiId) => (
      <I18nProvider>
        <Deroule clips={etat.clips} countries={pays} playerRef={{ current: null }} choisiId={choisiId} onChoisir={onChoisir}
          modifierMontage={modifierMontage} nouvelId={() => 'copie'} onRaccourcir={vi.fn()} onNom={vi.fn()} onSousTitres={vi.fn()} {...extra} />
      </I18nProvider>
    );
    return { etat, modifierMontage, onChoisir, vue, ...render(vue(extra.choisi ?? null)) };
  };

  it('vide, il explique les trois gestes', () => {
    monter([]);
    expect(screen.getByText('Votre JT est vide')).toBeInTheDocument();
    expect(screen.getByText(/Cliquez un rush à gauche/)).toBeInTheDocument();
  });

  it('montre chaque plan avec son pays, sa durée et l’instant où il passe', () => {
    monter([plan(1, { countryId: 'cm', reportage: 'Mokolo' }), plan(2, { outPoint: 80 })]);
    expect(screen.getByText('Cameroun · Mokolo')).toBeInTheDocument();
    expect(screen.getByText('1 min 20')).toBeInTheDocument();
    expect(screen.getByText('à 0:10')).toBeInTheDocument();
    expect(screen.getByText('2 plans · 1 min 30')).toBeInTheDocument();
  });

  it('les gestes n’apparaissent que sur le plan choisi, en mots simples', () => {
    const { etat } = monter([plan(1), plan(2)], { choisi: 'p1' });
    expect(screen.getAllByRole('button', { name: 'Raccourcir' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Descendre d’un rang' }));
    expect(etat.clips.map((c) => c.instanceId)).toEqual(['p2', 'p1']);
  });

  it('« Retirer » enlève le plan du JT', () => {
    const { etat, onChoisir } = monter([plan(1), plan(2)], { choisi: 'p2' });
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(etat.clips.map((c) => c.instanceId)).toEqual(['p1']);
    expect(onChoisir).toHaveBeenCalledWith(null);
  });

  it('le passage au plan suivant se règle sur le plan, sauf le dernier', () => {
    const { etat, rerender, vue } = monter([plan(1), plan(2)], { choisi: 'p1' });
    fireEvent.change(screen.getByLabelText('Passage au plan suivant'), { target: { value: 'fade' } });
    expect(etat.clips[0].transition).toEqual({ type: 'fade', duration: 0.5 });
    rerender(vue('p2'));
    expect(screen.queryByLabelText('Passage au plan suivant')).toBeNull();
  });

  // Suppr dans le champ de recherche ne doit jamais retirer un plan.
  it('au clavier : Suppr retire le plan choisi, mais pas pendant une saisie', () => {
    const { etat } = monter([plan(1), plan(2)], { choisi: 'p1' });
    const champ = document.createElement('input');
    document.body.appendChild(champ);
    fireEvent.keyDown(champ, { key: 'Delete' });
    expect(etat.clips).toHaveLength(2);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(etat.clips.map((c) => c.instanceId)).toEqual(['p2']);
    champ.remove();
  });

  it('Ctrl+Z annule, Ctrl+Maj+Z rétablit', () => {
    const onAnnuler = vi.fn(); const onRetablir = vi.fn();
    monter([plan(1)], { onAnnuler, onRetablir });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(onAnnuler).toHaveBeenCalledTimes(1);
    expect(onRetablir).toHaveBeenCalledTimes(1);
  });
});

describe('les rushes dans le studio', () => {
  const pays = [{ id: 'cm', name: 'Cameroun' }];
  const videos = [
    { id: '1', filename: 'a.mp4', name: 'interview-vendeuse.mp4', countryId: 'cm', reportage: 'Marché de Mokolo', status: 'approved' },
    { id: '2', filename: 'b.mp4', name: 'plans-marche.mp4', countryId: 'cm', reportage: 'Marché de Mokolo', status: 'pending' },
  ];

  it('un clic sur un rush l’ajoute au JT', () => {
    const onAjouter = vi.fn();
    render(<I18nProvider><RushesStudio videos={videos} clips={[]} countries={pays} onAjouter={onAjouter} /></I18nProvider>);
    fireEvent.click(screen.getByText('interview-vendeuse.mp4'));
    expect(onAjouter).toHaveBeenCalledWith(expect.objectContaining({ filename: 'a.mp4' }));
  });

  it('dit quels rushes servent déjà dans le JT', () => {
    render(<I18nProvider><RushesStudio videos={videos} clips={[{ filename: 'a.mp4' }]} countries={pays} onAjouter={() => {}} /></I18nProvider>);
    expect(screen.getByText('dans le JT')).toBeInTheDocument();
    expect(screen.getByText('à revoir')).toBeInTheDocument();
  });

  it('la recherche réduit la liste, et le dit quand elle ne trouve rien', () => {
    render(<I18nProvider><RushesStudio videos={videos} clips={[]} countries={pays} onAjouter={() => {}} /></I18nProvider>);
    fireEvent.change(screen.getByLabelText('Chercher un pays, un reportage…'), { target: { value: 'vendeuse' } });
    expect(screen.queryByText('plans-marche.mp4')).toBeNull();
    fireEvent.change(screen.getByLabelText('Chercher un pays, un reportage…'), { target: { value: 'zzz' } });
    expect(screen.getByText('Aucune vidéo ne correspond à cette recherche.')).toBeInTheDocument();
  });
});
