import { describe, it, expect, beforeEach, vi } from 'vitest';
import { oublierPaysMemorises, resolveCountry } from '../src/lib/homeCountry.js';

const COUNTRIES = [
  { id: 'ga', name: 'Gabon' },
  { id: 'ci', name: "Côte d'Ivoire" },
];

beforeEach(() => {
  localStorage.clear();
});

describe('homeCountry — plus de pays mémorisé', () => {
  // L'appareil retenait le dernier pays ouvert et l'imposait à l'accueil.
  // L'accès se fait sans compte : ces traces sont effacées au démarrage.
  it('efface les pays laissés par les versions précédentes, et rien d’autre', () => {
    localStorage.setItem('last_selected_country_id', 'ga');
    localStorage.setItem('reporter_home_country_id', 'ga');
    localStorage.setItem('jt-alwm-lang', 'fr');
    oublierPaysMemorises();
    expect(localStorage.getItem('last_selected_country_id')).toBeNull();
    expect(localStorage.getItem('reporter_home_country_id')).toBeNull();
    expect(localStorage.getItem('jt-alwm-lang')).toBe('fr');
  });

  it('survit à un stockage indisponible', () => {
    const espion = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(() => oublierPaysMemorises()).not.toThrow();
    espion.mockRestore();
  });
});

describe('homeCountry — résolution', () => {
  it('retrouve le pays dans la liste courante, sans tenir compte de la casse', () => {
    expect(resolveCountry(COUNTRIES, 'ga')).toEqual(COUNTRIES[0]);
    expect(resolveCountry(COUNTRIES, ' CI ')).toEqual(COUNTRIES[1]);
  });

  it('renvoie null pour un pays supprimé ou inconnu', () => {
    expect(resolveCountry(COUNTRIES, 'zz')).toBeNull();
    expect(resolveCountry(COUNTRIES, '')).toBeNull();
    expect(resolveCountry(null, 'ga')).toBeNull();
  });
});
