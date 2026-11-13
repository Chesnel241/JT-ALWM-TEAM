import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import SuiviReportage from '../src/components/SuiviReportage.jsx';
import DeliveryView from '../src/components/DeliveryView.jsx';
import { api } from '../src/api/index.js';
import { buildSections } from '../src/lib/sujets.js';
import { sommaireDuJT } from '../src/components/editor/sommaireJT.js';

// LE BESOIN : une fois ses fichiers envoyés, le correspondant ne savait plus
// rien jusqu'à la publication du JT — et alors, il parcourait trente minutes
// pour savoir si son reportage y était.

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

const suivre = (suivi, onRegarder = vi.fn()) => render(<I18nProvider><SuiviReportage suivi={suivi} onRegarder={onRegarder} /></I18nProvider>);

describe('le suivi de mon reportage', () => {
  it('ne montre rien tant qu’aucun fichier n’est arrivé', () => {
    const { container } = suivre({ etape: 'attendu' });
    expect(container).toBeEmptyDOMElement();
  });

  it('marque l’étape atteinte et dit ce qui se passe ensuite', () => {
    suivre({ etape: 'recu', recuLe: '2026-11-10T09:00:00Z' });
    expect(screen.getByText('Reçu').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Bien reçu le .*La rédaction va le regarder\./)).toBeInTheDocument();
  });

  it('signale une correction demandée, à la place de « vu »', () => {
    suivre({ etape: 'aCorriger' });
    expect(screen.getByText('À corriger').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/son message est sous le fichier concerné/)).toBeInTheDocument();
  });

  it('dit la minute du JT où il passe, et l’ouvre d’un geste', () => {
    const onRegarder = vi.fn();
    const diffusion = { livraisonId: 'jt1', t: 252, publieLe: '2026-11-15T18:00:00Z' };
    suivre({ etape: 'diffuse', diffusion }, onRegarder);
    expect(screen.getByText('Diffusé : il passe à 4:12 dans le JT.')).toBeInTheDocument();
    // Retenu, donc regardé : « Validé », pas seulement « Vu ».
    expect(screen.getByText('Validé')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Regarder' }));
    expect(onRegarder).toHaveBeenCalledWith(diffusion);
  });

  it('suit le reportage jusque dans les sections de l’espace du pays', () => {
    const suivi = { etape: 'vu' };
    const [section] = buildSections([{ id: 's1', titre: 'Le marché', etat: 'recu', suivi }], []);
    expect(section.suivi).toBe(suivi);
  });
});

describe('le sommaire dit quel reportage passe à quelle minute', () => {
  it('porte le reportage du plan, qu’il vienne du plan ou de la liste de la semaine', () => {
    const clips = [
      { instanceId: 'a', filename: 'a.mp4', sujetId: 'sujet-a', durationSec: 20, sourceDurationSec: 20, overlays: [{ templateId: 'titre_reportage', startTime: 0, fields: { titre: 'La pêche' } }] },
      { instanceId: 'b', filename: 'b.mp4', durationSec: 20, sourceDurationSec: 20, overlays: [] },
    ];
    const overlays = [{ templateId: 'titre_reportage', startTime: 20, duration: 5, fields: { titre: 'Le marché' } }];
    const sommaire = sommaireDuJT({ clips, overlays, sujetDe: (f) => (f === 'b.mp4' ? 'sujet-b' : null) });
    expect(sommaire).toEqual([
      { t: 0, titre: 'La pêche', sujetId: 'sujet-a' },
      { t: 20, titre: 'Le marché', sujetId: 'sujet-b' },
    ]);
  });
});

describe('ouvrir le JT à la minute de mon reportage', () => {
  it('lit le JT et la minute dans l’adresse, ouvre le lecteur, puis nettoie l’adresse', async () => {
    vi.spyOn(api, 'getDeliveries').mockResolvedValue([
      { id: 'jt1', name: 'JT ALWM - Semaine 46 (2026).mp4', filename: 'master.mp4', type: 'video', size: '450.0 MB', sommaire: [{ t: 0, titre: 'Générique' }, { t: 252, titre: 'Le marché' }] },
    ]);
    window.history.replaceState(null, '', '/journalistes/telecharger-le-jt?jt=jt1&a=252');
    render(
      <I18nProvider>
        <ToastProvider>
          <DeliveryView weeks={[{ id: '2026-w46', status: 'active' }]} selectedWeek="2026-w46" setSelectedWeek={vi.fn()} audience="reporter" />
        </ToastProvider>
      </I18nProvider>,
    );
    const lecteur = await screen.findByRole('dialog', { name: 'JT ALWM - Semaine 46 (2026).mp4' });
    expect(lecteur).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.pathname).toBe('/journalistes/telecharger-le-jt');
  });

  // L'INCIDENT : la page « JT Prêt » reste montée, cachée, pendant que le
  // correspondant regarde son reportage. « Regarder » y menait, mais elle
  // avait lu l'adresse au premier affichage, et le lecteur ne s'ouvrait pas.
  it('relit l’adresse en redevenant visible', async () => {
    vi.spyOn(api, 'getDeliveries').mockResolvedValue([
      { id: 'jt2', name: 'JT S46.mp4', filename: 'm.mp4', type: 'video', sommaire: [{ t: 0, titre: 'Générique' }] },
    ]);
    const page = (actif) => (
      <I18nProvider>
        <ToastProvider>
          <DeliveryView weeks={[{ id: '2026-w46', status: 'active' }]} selectedWeek="2026-w46" setSelectedWeek={vi.fn()} audience="reporter" isActive={actif} />
        </ToastProvider>
      </I18nProvider>
    );
    const { rerender } = render(page(false));
    await screen.findByText('JT S46.mp4');
    window.history.replaceState(null, '', '/journalistes/telecharger-le-jt?jt=jt2&a=0');
    rerender(page(true));
    expect(await screen.findByRole('dialog', { name: 'JT S46.mp4' })).toBeInTheDocument();
  });
});
