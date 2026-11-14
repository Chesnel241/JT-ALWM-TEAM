import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import VoyageEnvoi from '../src/components/VoyageEnvoi.jsx';

/**
 * On voit le fichier partir, et on voit qu'il est arrivé.
 *
 * LE BESOIN : la barre de progression atteignait 99 % puis s'arrêtait
 * pendant la compression ; des correspondants croyaient l'envoi bloqué et
 * quittaient la page. La liaison pays → rédaction et les trois étapes
 * nommées disent ce qui se passe.
 */

const PAYS = { id: 'cm', name: 'Cameroun', code: 'CM' };

function monter(envois, props = {}) {
  return render(<I18nProvider><VoyageEnvoi pays={PAYS} envois={envois} {...props} /></I18nProvider>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('VoyageEnvoi', () => {
  it('relie le drapeau du pays au logo de la rédaction, et place le fichier au pourcentage réel', () => {
    const { container } = monter([{ id: 'a', name: 'rush.mp4', status: 'uploading', phase: 'uploading', progress: 40 }]);
    expect(container.querySelector('img[src="/flags/cm.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src="/logo-lwm.png"]')).not.toBeNull();
    expect(container.querySelector('.jr-paquet-rail').style.getPropertyValue('--p')).toBe('0.4');
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText(/Gardez cette page ouverte/)).toBeInTheDocument();
  });

  it('pendant la compression, dit que le fichier est traité — et non bloqué', () => {
    const { container } = monter([{ id: 'a', name: 'rush.mp4', isVideo: true, status: 'uploading', phase: 'processing', progress: 99 }]);
    expect(screen.getByText('Nous compressons votre vidéo…')).toBeInTheDocument();
    const etats = [...container.querySelectorAll('.jr-pas')].map((p) => p.dataset.etat);
    expect(etats).toEqual(['fait', 'actif', 'avenir']);
  });

  it('sans réseau, le fichier attend au départ', () => {
    monter([{ id: 'a', name: 'rush.mp4', status: 'queued', phase: 'queued', progress: 0 }]);
    expect(screen.getByText('En attente du réseau')).toBeInTheDocument();
  });

  it('reçu : les trois étapes sont cochées, et le titre le dit', () => {
    const { container } = monter([{ id: 'a', name: 'rush.mp4', status: 'completed', phase: 'done', progress: 100 }]);
    expect(screen.getAllByText('Terminé !').length).toBeGreaterThan(0);
    expect([...container.querySelectorAll('.jr-pas')].every((p) => p.dataset.etat === 'fait')).toBe(true);
    expect(screen.queryByText(/Gardez cette page ouverte/)).toBeNull();
  });

  it('refusé : un bouton orange relance l’envoi sans repasser par le sélecteur', () => {
    const onReessayer = vi.fn();
    monter([{ id: 'a', name: 'rush.mp4', status: 'error', progress: 0, error: 'Fichier trop lourd' }], { onReessayer });
    expect(screen.getByText('Fichier trop lourd')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(onReessayer).toHaveBeenCalledWith('a');
  });

  // L'INCIDENT (tests de bout en bout, e2e/formats.spec.js) : deux fichiers
  // refusés s'affichaient sous « Terminé ! », chacun avec un gros
  // « Réessayer » qui ne pouvait pas réussir.
  it('un format refusé : pas de « Terminé », pas de « Réessayer », mais quoi envoyer à la place', () => {
    const onReessayer = vi.fn();
    monter([
      { id: 'a', name: 'lecteur.exe', status: 'error', error: 'Ce type de fichier n’est pas accepté.', formatRefuse: true },
      { id: 'b', name: 'page.mp4', status: 'error', error: 'Ce type de fichier n’est pas accepté.', formatRefuse: true },
    ], { onReessayer });
    expect(screen.queryByText('Terminé !')).toBeNull();
    expect(screen.getByText('Rien n’est parti')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Réessayer/ })).toBeNull();
    expect(screen.getAllByText(/Envoyez une vidéo, un son, une photo ou un texte/)).toHaveLength(2);
  });

  it('un envoi réussi et un échec : l’en-tête compte ce qui reste à revoir', () => {
    monter([
      { id: 'a', name: 'rush.mp4', status: 'completed', phase: 'done', progress: 100 },
      { id: 'b', name: 'son.mp3', status: 'error', error: 'Connexion perdue.' },
    ], { onReessayer: vi.fn() });
    expect(screen.getByText('1 fichier à revoir')).toBeInTheDocument();
    // Une coupure, elle, se reprend.
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
  });

  it('n’affiche rien sans envoi', () => {
    const { container } = monter([]);
    expect(container.firstChild).toBeNull();
  });
});

describe('le temps d’envoi estimé', () => {
  // LE BESOIN : « 37 % » ne dit pas si l'on attendra deux minutes ou une heure.
  const Mo = 1024 * 1024;

  it('dit la quantité envoyée et le temps restant', () => {
    monter([{
      id: 'a', name: 'rush.mp4', status: 'uploading', phase: 'uploading', progress: 14,
      envoyes: 12 * Mo, total: 85 * Mo, mesure: { debit: (73 * Mo) / 360 },
    }]);
    expect(screen.getByText(/12 Mo sur 85 Mo/)).toBeInTheDocument();
    expect(screen.getByText(/environ 6 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Wi-Fi/)).toBeNull();
  });

  it('au-delà d’une demi-heure, conseille le Wi-Fi', () => {
    monter([{
      id: 'a', name: 'rush.mp4', status: 'uploading', phase: 'uploading', progress: 2,
      envoyes: 10 * Mo, total: 900 * Mo, mesure: { debit: 100 * 1024 },
    }]);
    expect(screen.getByText('En Wi-Fi, ce sera plus rapide.')).toBeInTheDocument();
  });

  it('ne promet rien avant d’avoir mesuré le débit', () => {
    monter([{ id: 'a', name: 'rush.mp4', status: 'uploading', phase: 'uploading', progress: 0, envoyes: 0, total: 85 * Mo }]);
    expect(screen.getByText('0 Ko sur 85 Mo')).toBeInTheDocument();
    expect(screen.queryByText(/environ/)).toBeNull();
  });
});
