import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * Le compte à rebours dit l'heure du correspondant, et sa couleur dit
 * l'urgence.
 *
 * LE BESOIN : un journaliste en GMT-3 lisait « dimanche 10h30 (GMT+2) » et
 * devait retrancher cinq heures de tête. Ici, le navigateur est placé à São
 * Paulo : l'écran doit annoncer 05h30, « votre heure (GMT-3) », et rappeler
 * l'heure de la rédaction en petit.
 */

vi.mock('../src/lib/echeance.js', async (original) => ({
  ...(await original()),
  fuseauNavigateur: () => 'America/Sao_Paulo',
}));

const { default: CountdownTimer } = await import('../src/components/CountdownTimer.jsx');

// Dimanche 1er novembre 2026, 10h30 GMT+2.
const SEMAINE = { id: '2026-w44', startDate: '2026-10-25T22:00:00.000Z', cutoffAt: '2026-11-01T08:30:00.000Z' };

function monter(props, lang = 'fr') {
  localStorage.setItem('jt-alwm-lang', lang);
  return render(<I18nProvider><CountdownTimer week={SEMAINE} {...props} /></I18nProvider>);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('CountdownTimer', () => {
  it('annonce la clôture dans l’heure du correspondant, et la référence de la rédaction', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const { container } = monter();
    expect(screen.getByText('Clôture : dimanche 1 nov. à 05h30')).toBeInTheDocument();
    expect(screen.getByText('votre heure (GMT-3)')).toBeInTheDocument();
    expect(container.textContent).toContain('10h30 GMT+2 à la rédaction');
  });

  it.each([
    ['2026-10-28T12:00:00Z', 'serein', 'Vous avez le temps'],
    ['2026-10-31T08:30:00Z', 'proche', 'Pensez à envoyer bientôt'],
    ['2026-11-01T02:00:00Z', 'urgent', 'Dernières heures : envoyez maintenant'],
    ['2026-11-01T09:00:00Z', 'clos', 'Les envois de la semaine sont clôturés'],
  ])('à %s : phase %s', (instant, phase, libelle) => {
    vi.setSystemTime(new Date(instant));
    const { container } = monter();
    expect(container.querySelector('.cr').dataset.phase).toBe(phase);
    expect(screen.getByText(libelle)).toBeInTheDocument();
  });

  it('les chiffres suivent le temps qui passe', () => {
    vi.setSystemTime(new Date('2026-11-01T06:29:58Z'));
    const { container } = monter();
    const lire = () => [...container.querySelectorAll('.cr-case')].map((c) => c.textContent).join('');
    expect(lire()).toBe('00020002');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(lire()).toBe('00015959');
  });

  it('marque aujourd’hui sur le ruban de la semaine, dans le calendrier du correspondant', () => {
    // Mercredi 28 octobre à São Paulo.
    vi.setSystemTime(new Date('2026-10-28T15:00:00Z'));
    const { container } = monter();
    const jours = [...container.querySelectorAll('.cr-jour')];
    expect(jours).toHaveLength(7);
    expect(jours[2].dataset.etat).toBe('aujourdhui');
    expect(screen.getByText('Aujourd’hui')).toBeInTheDocument();
  });

  it('en version compacte, garde la couleur, le temps et l’heure locale', () => {
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));
    const { container } = monter({ compact: true });
    expect(container.querySelector('.cr').dataset.phase).toBe('urgent');
    expect(screen.getByText('02:30:00')).toBeInTheDocument();
    expect(container.textContent).toContain('Clôture : dimanche 05h30 · votre heure (GMT-3)');
  });

  it('en version compacte, une fois clos, ne répète pas « Clôturé »', () => {
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    monter({ compact: true });
    expect(screen.getAllByText('Clôturé')).toHaveLength(1);
  });

  it('se lit d’une phrase par un lecteur d’écran, sans égrener les secondes', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    monter({}, 'en');
    const minuteur = screen.getByRole('timer');
    expect(minuteur).toHaveAccessibleName(/Time left to send: 3 days 20 hours\. Deadline: Sunday, Nov 1 at 5:30 AM, your time \(GMT-3\)/);
  });
});

describe('CountdownTimer en une ligne (page d’envoi sur téléphone)', () => {
  // La carte, même compacte, repoussait le bouton d'envoi sous la ligne de
  // flottaison. Une ligne suffit tant qu'on a le temps ; le détail au toucher.
  it('tient sur une ligne, et se déplie au toucher', async () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const { fireEvent } = await import('@testing-library/react');
    const { container } = monter({ ligne: true });
    const ligne = screen.getByRole('button', { expanded: false });
    expect(ligne).toHaveTextContent(/Clôture.*05h30/);
    expect(container.querySelector('.cr-compact')).toBeNull();
    fireEvent.click(ligne);
    expect(container.querySelector('.cr-compact')).not.toBeNull();
  });

  it('montre la carte d’emblée dans la dernière ligne droite', () => {
    // Moins de deux heures : ce moment-là doit se voir sans rien toucher.
    vi.setSystemTime(new Date('2026-11-01T07:30:00Z'));
    const { container } = monter({ ligne: true });
    expect(container.querySelector('.cr-compact')).not.toBeNull();
  });
});

describe('CountdownTimer en sablier', () => {
  // LE BESOIN (le propriétaire) : « au lieu d'une jauge, un grand sablier
  // dynamique, réaliste ; le sable garde les couleurs actuelles selon la
  // progression du temps ; ça doit être vivant ».
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/styles/journalistes.css'), 'utf8');
  const regle = (selecteur) => {
    const i = css.indexOf(`${selecteur} {`);
    expect(i, selecteur).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf('}', i));
  };
  const surface = (c) => Number(c.querySelector('.cr-sablier-surface').getAttribute('cy'));

  it('remplace l’anneau par un sablier, grand sur la carte et petit en version compacte', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const { container } = monter();
    expect(container.querySelector('.cr-sablier.cr-sablier-grand svg')).not.toBeNull();
    expect(container.querySelector('.cr-arc')).toBeNull();

    const compacte = monter({ compact: true }).container;
    expect(compacte.querySelector('.cr-sablier.cr-sablier-mini')).not.toBeNull();
    // À 48 px, les grains qui tombent ne se verraient pas : on ne les dessine pas.
    expect(compacte.querySelector('.cr-sablier-grain')).toBeNull();
    expect(compacte.querySelector('.cr-sablier-filet')).not.toBeNull();
  });

  it('vide l’ampoule du haut à mesure que la clôture approche', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const tot = monter().container;
    const hautTot = surface(tot);
    const tasTot = tot.querySelector('.cr-sablier-tas').getAttribute('d');

    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
    const tard = monter().container;
    // L'axe des y descend : une surface plus basse a un cy plus grand.
    expect(surface(tard)).toBeGreaterThan(hautTot + 10);
    expect(tard.querySelector('.cr-sablier-tas').getAttribute('d')).not.toBe(tasTot);
  });

  it('une fois clos : tout le sable en bas, plus de filet, un cadenas', () => {
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    const { container } = monter();
    const sablier = container.querySelector('.cr-sablier');
    expect(sablier.dataset.coule).toBe('0');
    expect(container.querySelector('.cr-sablier-surface')).toBeNull();
    expect(container.querySelector('.cr-sablier-filet')).toBeNull();
    expect(container.querySelector('.cr-sablier-reflet')).toBeNull();
    expect(container.querySelector('.cr-sablier-tas')).not.toBeNull();
    expect(sablier.querySelector('.cr-sablier-badge svg')).not.toBeNull();
  });

  it('colore le sable de la couleur de la phase, comme l’ancienne jauge', () => {
    for (const teinte of ['coeur', 'bord', 'lumiere']) {
      expect(regle(`.cr-sablier-sable-${teinte}`)).toMatch(/stop-color:[^;]*var\(--cr-couleur\)/);
    }
    expect(regle('.cr')).toMatch(/--cr-couleur: var\(--jauge-serein\)/);
    expect(regle(".cr[data-phase='proche']")).toMatch(/--cr-couleur: var\(--jauge-proche\)/);
    expect(regle(".cr[data-phase='urgent']")).toMatch(/--cr-couleur: var\(--jauge-urgent\)/);
  });

  it('fait couler le sable plus vite à l’approche de la clôture', () => {
    const duree = (r) => Number(r.match(/--cr-filet: ([\d.]+)s/)[1]);
    const serein = duree(regle('.cr-sablier'));
    const proche = duree(regle(".cr[data-phase='proche'] .cr-sablier"));
    const urgent = duree(regle(".cr[data-phase='urgent'] .cr-sablier"));
    expect(serein).toBeGreaterThan(proche);
    expect(proche).toBeGreaterThan(urgent);
  });

  it('coupe grains, bouffée et reflet en mode économe, mais laisse couler le filet', () => {
    const econome = css.slice(css.indexOf('html[data-econome] .jr-ciel::after'));
    const bloc = econome.slice(0, econome.indexOf('}'));
    for (const c of ['cr-sablier-grain', 'cr-sablier-impact', 'cr-sablier-reflet']) expect(bloc).toContain(c);
    expect(bloc).not.toContain('cr-sablier-filet');
  });

  it('donne à chaque sablier ses propres dégradés, même à deux sur la page', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const { container } = render(
      <I18nProvider>
        <CountdownTimer week={SEMAINE} />
        <CountdownTimer week={SEMAINE} compact ancre={null} />
      </I18nProvider>,
    );
    const ids = [...container.querySelectorAll('.cr-sablier [id]')].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    // Chaque remplissage vise un dégradé de son propre sablier.
    for (const sablier of container.querySelectorAll('.cr-sablier')) {
      const propres = new Set([...sablier.querySelectorAll('[id]')].map((e) => e.id));
      const vises = [...sablier.querySelectorAll('[fill^="url(#"], [clip-path^="url(#"]')]
        .map((e) => (e.getAttribute('fill') || e.getAttribute('clip-path')).slice(5, -1));
      expect(vises.filter((v) => !propres.has(v))).toEqual([]);
    }
  });
});
