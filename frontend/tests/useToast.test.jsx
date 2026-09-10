import { describe, expect, it } from 'vitest';
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
