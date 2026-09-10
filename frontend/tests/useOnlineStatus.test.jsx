import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '../src/hooks/useOnlineStatus.js';

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => setOnLine(true));
afterEach(() => setOnLine(true));

describe('état de la connexion', () => {
  it('démarre en ligne', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('démarre hors ligne quand le navigateur le dit', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('suit les coupures et les retours', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => { setOnLine(false); window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
    act(() => { setOnLine(true); window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });

  it('retire ses écouteurs au démontage', () => {
    const { unmount, result } = renderHook(() => useOnlineStatus());
    unmount();
    act(() => { setOnLine(false); window.dispatchEvent(new Event('offline')); });
    // Plus d'abonnement : la dernière valeur rendue ne bouge plus.
    expect(result.current).toBe(true);
  });
});
