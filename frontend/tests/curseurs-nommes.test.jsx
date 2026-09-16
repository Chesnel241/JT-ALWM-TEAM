import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OverlayPanel from '../src/components/editor/OverlayPanel.jsx';
import GlobalLayerPanel from '../src/components/editor/GlobalLayerPanel.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { DEFAULT_BRANDING } from '../src/components/editor/timelineWorkspace.js';

/**
 * Ce qu'un lecteur d'écran annonce devant un curseur.
 *
 * L'incident : vingt curseurs sur vingt-et-un n'avaient pas de nom
 * accessible — quatorze dans l'habillage JT, six dans l'habillage du clip. Un
 * lecteur d'écran y annonçait « curseur, 100 » sans dire de quoi, et il y en a
 * trois d'affilée qui se ressemblent (Position X, Position Y, Taille).
 *
 * Le libellé était pourtant là, juste au-dessus, et déjà traduit. Il n'était
 * simplement relié à rien : sur les trente-quatre `<label>` des deux panneaux,
 * l'éditeur entier comptait **un seul `htmlFor`**.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../src');

const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? fichiers(join(dossier, e.name)) : (e.name.endsWith('.jsx') ? [join(dossier, e.name)] : [])
));

/**
 * Découpe les balises `<input …>` en respectant les accolades JSX.
 *
 * Une expression régulière naïve s'arrête au premier `>` — donc au milieu du
 * premier gestionnaire `onChange={(e) => …}`, et déclare nommé un curseur qui
 * ne l'est pas. C'est ce qui avait faussé le premier relevé.
 */
function balisesInput(source) {
  const trouvees = [];
  for (const m of source.matchAll(/<input\b/g)) {
    let i = m.index + m[0].length;
    let profondeur = 0;
    while (i < source.length) {
      const c = source[i];
      if (c === '{') profondeur += 1;
      else if (c === '}') profondeur -= 1;
      else if (c === '>' && profondeur === 0) {
        trouvees.push({ debut: m.index, balise: source.slice(m.index, i + 1) });
        break;
      }
      i += 1;
    }
  }
  return trouvees;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('les curseurs du studio disent de quoi ils règlent', () => {
  it('aucun ne part sans nom accessible', () => {
    const nus = [];
    fichiers(RACINE).forEach((f) => {
      const source = readFileSync(f, 'utf8');
      balisesInput(source).forEach(({ debut, balise }) => {
        if (!balise.includes('type="range"')) return;
        if (/aria-label(ledby)?=|\sid=/.test(balise)) return;
        nus.push(`${f.slice(RACINE.length + 1)}:${source.slice(0, debut).split('\n').length}`);
      });
    });
    expect(nus, 'ces curseurs annoncent « curseur, 100 » sans dire de quoi').toEqual([]);
  });

  it('en couvre bien vingt et un', () => {
    // Un balayage qui ne voit rien passe toujours.
    const total = fichiers(RACINE).reduce((n, f) => (
      n + balisesInput(readFileSync(f, 'utf8')).filter((b) => b.balise.includes('type="range"')).length
    ), 0);
    expect(total).toBe(21);
  });
});

describe('le nom vient du libellé, et ne contient pas la valeur', () => {
  const rendre = (noeud) => render(<I18nProvider>{noeud}</I18nProvider>);

  it('nomme les curseurs de l’habillage du clip', () => {
    rendre(
      <OverlayPanel
        clip={{ instanceId: 'c1', overlays: [{ id: 'o1', templateId: 'titre_reportage', fields: {}, startTime: 0 }] }}
        onClose={() => {}}
        onSave={() => {}}
        inline
      />,
    );
    // Le terme seul : associé avec sa valeur, le nom serait « Contour : 4 » et
    // changerait à chaque cran, alors que la valeur est déjà annoncée par
    // `aria-valuenow`.
    ['Contour', 'Halo', 'Position X', 'Position Y'].forEach((nom) => {
      expect(screen.getByRole('slider', { name: nom }), `« ${nom} » n’a pas de curseur`).toBeInTheDocument();
    });
  });

  it('nomme les curseurs de l’habillage JT', () => {
    rendre(
      <GlobalLayerPanel
        value={{ ...DEFAULT_BRANDING, atmosphere: { vignette: 0.2, grain: 0, sweep: 0 } }}
        onChange={() => {}}
        onClose={() => {}}
        inline
      />,
    );
    ['Vignettage', 'Grain (film)', 'Balayage lumineux'].forEach((nom) => {
      expect(screen.getByRole('slider', { name: nom }), `« ${nom} » n’a pas de curseur`).toBeInTheDocument();
    });
  });

  it('nomme aussi en anglais, sans reste de français', () => {
    // Neuf libellés de curseur étaient écrits en français dans le code.
    // Relier un curseur à un libellé que le monteur anglophone ne comprend pas
    // ne l'avance pas beaucoup.
    localStorage.setItem('jt-alwm-lang', 'en');
    rendre(
      <GlobalLayerPanel
        value={{ ...DEFAULT_BRANDING, atmosphere: { vignette: 0.2, grain: 0, sweep: 0 } }}
        onChange={() => {}}
        onClose={() => {}}
        inline
      />,
    );
    expect(screen.getByRole('slider', { name: 'Film grain' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /Vignettage|Sweep lumineux/ })).toBeNull();
  });

  it('donne un identifiant propre à chaque panneau monté', () => {
    // Deux habillages édités côte à côte : un identifiant partagé ferait
    // donner le focus au curseur du voisin quand on clique un libellé.
    const clip = (n) => ({ instanceId: `c${n}`, overlays: [{ id: `o${n}`, templateId: 'titre_reportage', fields: {}, startTime: 0 }] });
    rendre(<><OverlayPanel clip={clip(1)} onClose={() => {}} onSave={() => {}} inline /><OverlayPanel clip={clip(2)} onClose={() => {}} onSave={() => {}} inline /></>);
    const identifiants = screen.getAllByRole('slider', { name: 'Contour' }).map((e) => e.id);
    expect(identifiants).toHaveLength(2);
    expect(new Set(identifiants).size, 'les deux panneaux partagent un identifiant').toBe(2);
  });
});
