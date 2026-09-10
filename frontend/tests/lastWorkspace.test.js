import { describe, it, expect, beforeEach } from 'vitest';
import { readLastWorkspace, saveLastWorkspace } from '../src/lib/lastWorkspace.js';
import { WORKSPACES } from '../src/lib/routing.js';

beforeEach(() => localStorage.clear());

describe('dernier espace utilisé', () => {
  it('ne se souvient de rien au premier lancement', () => {
    expect(readLastWorkspace()).toBe('');
  });

  it('retient les deux espaces', () => {
    saveLastWorkspace(WORKSPACES.REPORTER);
    expect(readLastWorkspace()).toBe(WORKSPACES.REPORTER);
    saveLastWorkspace(WORKSPACES.EDITOR);
    expect(readLastWorkspace()).toBe(WORKSPACES.EDITOR);
  });

  it('refuse une valeur qui n\'est pas un espace', () => {
    saveLastWorkspace('administrateur');
    expect(readLastWorkspace()).toBe('');
  });

  it('ignore un contenu de stockage invalide', () => {
    localStorage.setItem('last_workspace', 'nimporte-quoi');
    expect(readLastWorkspace()).toBe('');
  });
});
