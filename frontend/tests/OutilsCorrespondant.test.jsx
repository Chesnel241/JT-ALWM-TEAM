import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import OutilsCorrespondant from '../src/components/OutilsCorrespondant.jsx';
import ToastContainer from '../src/components/Toast.jsx';

const PAYS = { id: 'cm', name: 'Cameroun' };
const SEMAINE = { id: '2026-w45', cutoffAt: '2026-11-08T08:30:00.000Z' };

function monter() {
  return render(
    <I18nProvider><ToastProvider><OutilsCorrespondant pays={PAYS} semaine={SEMAINE} /><ToastContainer /></ToastProvider></I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('garder mon accès', () => {
  // LE BESOIN : le lien se perdait dans les conversations WhatsApp, et le
  // correspondant ne retrouvait plus sa page d'une semaine à l'autre.
  it('propose de s’envoyer l’adresse du pays sur WhatsApp — sans le jeton personnel', () => {
    localStorage.setItem('reporter_token', 'secret-porteur-123');
    monter();
    fireEvent.click(screen.getByRole('button', { name: /Garder mon accès/ }));
    const lien = screen.getByRole('link', { name: /M’envoyer ce lien sur WhatsApp/ });
    const texte = new URL(lien.href).searchParams.get('text');
    expect(lien.href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(texte).toContain('/journalistes/cm');
    expect(texte).not.toContain('secret-porteur-123');
  });

  it('sans installation possible, explique le geste à faire', () => {
    monter();
    fireEvent.click(screen.getByRole('button', { name: /Garder mon accès/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter à l’écran d’accueil/ }));
    return screen.findByText(/écran d’accueil/, { selector: '[role="status"]' });
  });
});

describe('le rappel de clôture', () => {
  it('télécharge un fichier d’agenda pour la clôture de la semaine', async () => {
    const blobs = [];
    URL.createObjectURL = vi.fn((b) => { blobs.push(b); return 'blob:ics'; });
    URL.revokeObjectURL = vi.fn();
    monter();
    fireEvent.click(screen.getByRole('button', { name: /Rappel dans mon agenda/ }));
    expect(blobs).toHaveLength(1);
    const contenu = await blobs[0].text();
    expect(contenu).toContain('DTSTART:20261108T083000Z');
    expect(contenu).toContain('SUMMARY:Clôture des envois JT ALWM — Cameroun');
    expect(await screen.findByText(/Rappel prêt/)).toBeInTheDocument();
  });
});
