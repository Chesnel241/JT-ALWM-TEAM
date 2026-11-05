import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/hooks/useToast.jsx';

// Le tableau de bord de montage consomme ce contexte : si sa valeur change à
// chaque rendu du provider, chaque toast re-rend toute l'application.
function renderHarness() {
  const seen = [];
  let rerenderParent;

  function Consumer() {
    seen.push(useToast());
    return null;
  }

  function Harness() {
    const [, setTick] = useState(0);
    rerenderParent = () => setTick((tick) => tick + 1);
    return (
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );
  }

  render(<Harness />);
  return { seen, rerenderParent: () => act(() => rerenderParent()) };
}

describe('ToastProvider — stabilité de la valeur de contexte', () => {
  it('garde la même valeur de contexte quand le provider re-rend sans nouveau toast', () => {
    const { seen, rerenderParent } = renderHarness();

    rerenderParent();
    rerenderParent();

    expect(seen.length).toBeGreaterThan(1);
    seen.forEach((value) => expect(value).toBe(seen[0]));
  });

  it('ne renouvelle la valeur que lorsque la liste de toasts change', () => {
    const { seen } = renderHarness();
    const before = seen[seen.length - 1];

    act(() => { before.addToast('Montage sauvegardé', 'success', 0); });

    const after = seen[seen.length - 1];
    expect(after).not.toBe(before);
    expect(after.toasts).toHaveLength(1);
    // Les fonctions, elles, restent stables : un consommateur qui ne lit que
    // addToast n'a aucune raison d'être invalidé.
    expect(after.addToast).toBe(before.addToast);
    expect(after.removeToast).toBe(before.removeToast);
  });
});

describe('combien de temps un message reste affiché', () => {
  // L'INCIDENT : tout message disparaissait au bout de 3 s, quelle que soit
  // la durée demandée ; une erreur longue n'était qu'un éclair rouge.
  function monter() {
    const vu = { current: null };
    function Lecteur() { vu.current = useToast(); return null; }
    render(<ToastProvider><Lecteur /></ToastProvider>);
    return vu;
  }

  it('respecte la durée demandée', () => {
    vi.useFakeTimers();
    const vu = monter();
    act(() => { vu.current.addToast('Délai accordé', 'success', 8000); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(vu.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(3500); });
    expect(vu.current.toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it('garde une erreur jusqu’à ce qu’on la ferme', () => {
    vi.useFakeTimers();
    const vu = monter();
    act(() => { vu.current.addToast('Envoi impossible', 'error', 4000); });
    act(() => { vi.advanceTimersByTime(60000); });
    expect(vu.current.toasts).toHaveLength(1);
    act(() => { vu.current.removeToast(vu.current.toasts[0].id); });
    expect(vu.current.toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it('n’empile pas dix fois le même message', () => {
    const vu = monter();
    act(() => {
      for (let i = 0; i < 10; i += 1) vu.current.addToast('Sauvegarde impossible', 'error');
    });
    expect(vu.current.toasts).toHaveLength(1);
  });
});

describe('le message affiché', () => {
  it('ne pose pas son propre minuteur de 3 s, et parle la langue de l’écran', async () => {
    const { default: ToastContainer } = await import('../src/components/Toast.jsx');
    const { I18nProvider } = await import('../src/i18n/I18nContext.jsx');
    const { screen, fireEvent } = await import('@testing-library/react');
    localStorage.setItem('jt-alwm-lang', 'fr');
    vi.useFakeTimers();
    const vu = { current: null };
    function Lecteur() { vu.current = useToast(); return null; }
    render(<I18nProvider><ToastProvider><Lecteur /><ToastContainer /></ToastProvider></I18nProvider>);

    const action = vi.fn();
    act(() => { vu.current.addToast('8 fichiers validés', 'success', 8000, { action: { libelle: 'Annuler', onClick: action } }); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('8 fichiers validés')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer le message' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('8 fichiers validés')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
