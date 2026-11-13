import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import GrillePays from '../src/components/GrillePays.jsx';
import Nav from '../src/components/Nav.jsx';

// LE BESOIN (le propriétaire) : « pas trop de trucs flashy ; propre,
// professionnel, pratique, agréable à la vue ». L'espace journalistes portait
// une trentaine d'animations en boucle : taches de couleur qui dérivaient
// derrière les titres, lignes d'écran qui défilaient sur le JT, icônes qui
// flottaient dans la zone de dépôt, badge « Nouveau » qui sautillait…
// Ne bouge plus en continu que ce qui dit un état réel.

const ICI = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(ICI, '../src/styles/journalistes.css'), 'utf8');

/** Les sélecteurs dont une animation tourne en boucle. */
function bouclesInfinies(texte) {
  const resultat = [];
  let selecteur = '';
  for (const ligne of texte.split('\n')) {
    if (/\{\s*$/.test(ligne) && !ligne.trim().startsWith('@')) selecteur = ligne.trim().replace(/\s*\{$/, '');
    if (/animation[^:]*:[^;]*infinite/.test(ligne)) resultat.push(selecteur);
  }
  return resultat;
}

// Chacune dit quelque chose : le temps qui reste, un envoi en cours, un
// enregistrement, un fichier qu'on survole pour le lâcher.
const AUTORISEES = new Set([
  '.cr-halo', // le compte à rebours respire plus vite à l'approche de la clôture
  '.cr-trotteuse', // l'aiguille des secondes
  '.jr-egaliseur i', // l'égaliseur du micro, au survol seulement
  '.jr-liaison-piste[data-actif]::before', // un envoi en cours
  '.jr-paquet', // le fichier en route
  ".jr-pas[data-etat='actif'] .jr-pas-point::after", // l'étape en cours
  '.jr-depot[data-glisse] .jr-depot-icones > .jr-depot-nuage', // un fichier survole la zone
  '.jr-depot[data-glisse] .jr-depot-bord rect',
  '.jr-jt a:focus-visible .jr-jt-fleche', // au survol ou au focus seulement
  ".jr-micro[data-etat='rec'] .jr-micro-halo", // on enregistre
  ".jr-micro[data-etat='rec'] .jr-micro-halo::after",
  '.jr-micro-point', // le point « REC »
  '.jr-onde[data-actif] .jr-onde-barre', // l'onde de la voix
]);

describe('l’espace journalistes, sobre', () => {
  it('ne fait tourner en boucle que ce qui dit un état réel', () => {
    const inattendues = bouclesInfinies(css).filter((s) => !AUTORISEES.has(s));
    expect(inattendues, 'animations en boucle décoratives').toEqual([]);
  });

  it('a retiré les taches de couleur et les lignes d’écran qui défilaient', () => {
    expect(css).not.toMatch(/jr-derive|jr-balayage|jr-ondes-lecture|jr-vent/);
  });

  it('présente chaque pays par son drapeau, son nom et une flèche — sans « Entrer » répété', () => {
    render(
      <I18nProvider>
        <ToastProvider>
          <GrillePays countries={[{ id: 'cm', name: 'Cameroun', code: 'CM' }, { id: 'sn', name: 'Sénégal', code: 'SN' }]} requete="" onSelectCountry={vi.fn()} />
        </ToastProvider>
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /Cameroun/ })).toBeInTheDocument();
    expect(screen.queryByText('Entrer')).toBeNull();
    expect(screen.queryByText(/^Journaliste$/i)).toBeNull();
  });

  // Le repère de l'onglet actif porte un nom de transition : c'est lui que le
  // navigateur fait glisser d'un onglet à l'autre.
  it('marque l’onglet actif d’un repère qui glisse, au lieu d’un bloc plein', () => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const { container } = render(
      <I18nProvider>
        <Nav currentView="uploader" setCurrentView={vi.fn()} workspace="reporter" isReporter onTextSize={vi.fn()} />
      </I18nProvider>,
    );
    const actifs = container.querySelectorAll('[aria-current="page"]');
    expect(actifs.length).toBeGreaterThan(0);
    for (const onglet of actifs) {
      expect(onglet.querySelector('.onglet-repere')).not.toBeNull();
      expect(onglet.className).not.toMatch(/bg-\[var\(--accent\)\] text-white/);
    }
  });
});
