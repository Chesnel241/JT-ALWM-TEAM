import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JinglesView, { rangerJingles } from '../src/components/JinglesView.jsx';
import { RushesStudio } from '../src/components/editor/Conducteur.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { api } from '../src/api/index.js';

beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); vi.restoreAllMocks(); });

const jingle = (id, categorie, name) => ({ id, categorie, name, filename: `jingle-${id}.mp4`, taille: 12 * 1024 * 1024, durationSec: 8, uploadedAt: '2026-11-10T10:00:00Z' });
const JINGLES = [jingle('m', 'mot', 'Mot du JT'), jingle('g', 'generique', 'Générique 2026'), jingle('r', 'reportages', 'Virgule reportages')];

const poser = (props = {}) => {
  const onChange = vi.fn(); const onAjouterAuJT = vi.fn();
  render(<I18nProvider><ToastProvider><JinglesView jingles={JINGLES} adminPassword="secret" onChange={onChange} onAjouterAuJT={onAjouterAuJT} {...props} /></ToastProvider></I18nProvider>);
  return { onChange, onAjouterAuJT };
};

// LE BESOIN : générique et virgules sont montés à part et resservent chaque
// semaine. Ils ont leur onglet, rangés dans l'ordre du journal, et restent
// jusqu'à suppression manuelle.
describe('l’onglet des jingles', () => {
  it('range les cinq catégories dans l’ordre du journal', () => {
    poser();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Générique du JT', 'Jingle des reportages', 'Jingle des annonces', 'Jingle des séminaires de la semaine', 'Jingle du Mot du JT',
    ]);
    expect(rangerJingles(JINGLES).map((c) => c.jingles.length)).toEqual([1, 1, 0, 0, 1]);
  });

  it('une catégorie vide le dit, et propose d’ajouter une vidéo', () => {
    poser();
    expect(screen.getAllByText('Aucune vidéo pour l’instant.')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Ajouter une vidéo' })).toHaveLength(5);
  });

  it('une vidéo choisie part dans sa catégorie', async () => {
    const envoi = vi.spyOn(api, 'uploadJingle').mockResolvedValue({ jingle: {} });
    const { onChange } = poser();
    const fichier = new File(['x'], 'annonces.mp4', { type: 'video/mp4' });
    const champs = document.querySelectorAll('input[type=file]');
    fireEvent.change(champs[2], { target: { files: [fichier] } }); // troisième catégorie : annonces
    await waitFor(() => expect(envoi).toHaveBeenCalledWith(fichier, 'annonces', 'secret', expect.any(Function)));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('« Ajouter au JT » envoie le jingle dans le montage', () => {
    const { onAjouterAuJT } = poser();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajouter au JT' })[0]);
    expect(onAjouterAuJT).toHaveBeenCalledWith(expect.objectContaining({ id: 'g', filename: 'jingle-g.mp4' }));
  });

  // Un jingle ne doit jamais disparaître d'un clic malheureux.
  it('ne supprime qu’après confirmation', async () => {
    const suppression = vi.spyOn(api, 'deleteJingle').mockResolvedValue({ ok: true });
    const { onChange } = poser();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Générique 2026' }));
    expect(suppression).not.toHaveBeenCalled();
    expect(screen.getByText('Supprimer ce jingle ?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(suppression).toHaveBeenCalledWith('g', 'secret'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});

describe('les jingles dans le studio', () => {
  it('sont proposés en tête des rushes, dans l’ordre du journal, et s’ajoutent d’un clic', () => {
    const onAjouter = vi.fn();
    render(<I18nProvider><RushesStudio videos={[]} clips={[]} countries={[]} jingles={JINGLES} onAjouter={onAjouter} /></I18nProvider>);
    const noms = ['Générique 2026', 'Virgule reportages', 'Mot du JT'].map((n) => screen.getByText(n));
    expect(noms[0].compareDocumentPosition(noms[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(noms[1].compareDocumentPosition(noms[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(noms[0]);
    expect(onAjouter).toHaveBeenCalledWith(expect.objectContaining({ id: 'g' }));
  });
});
