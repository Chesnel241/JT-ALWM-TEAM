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

  it('n’affiche rien sans envoi', () => {
    const { container } = monter([]);
    expect(container.firstChild).toBeNull();
  });
});
