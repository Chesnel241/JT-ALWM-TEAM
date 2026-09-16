import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usePiegeFocus, elementsFocalisables, premierFocus } from '../src/hooks/usePiegeFocus.jsx';

/**
 * Ce qu'une boîte modale doit au clavier.
 *
 * L'incident : neuf composants du studio déclaraient `role="dialog"
 * aria-modal="true"`, deux seulement tenaient la promesse. Dans les sept
 * autres, la tabulation repartait derrière le voile — sur les boutons de la
 * page qu'on croyait avoir quittée — et Échap ne fermait rien. Un monteur sans
 * souris ne pouvait ni faire le tour d'un panneau, ni en sortir.
 *
 * Et les deux qui l'avaient portaient deux copies quasi identiques de la même
 * quarantaine de lignes. On teste le hook, une fois, plutôt que neuf panneaux.
 */

/** Un panneau réduit à ce qui compte : un bouton qui ouvre, trois qui suivent. */
function Panneau({ surFermeture = () => {}, champ = false, tousDesactives = false }) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = () => { setOuvert(false); surFermeture(); };
  const boite = usePiegeFocus(ouvert, fermer);

  return (
    <div>
      <button type="button" onClick={() => setOuvert(true)}>ouvrir</button>
      <button type="button">derrière le voile</button>
      {ouvert && (
        <div ref={boite} role="dialog" aria-modal="true" aria-label="panneau">
          {champ && <input aria-label="titre" />}
          <button type="button" disabled={tousDesactives}>premier</button>
          <button type="button" disabled={tousDesactives}>milieu</button>
          <button type="button" disabled={tousDesactives} onClick={fermer}>dernier</button>
        </div>
      )}
    </div>
  );
}

const ouvrir = () => fireEvent.click(screen.getByRole('button', { name: 'ouvrir' }));
const tab = (options = {}) => fireEvent.keyDown(document, { key: 'Tab', ...options });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('le tour du panneau, à la tabulation', () => {
  it('ramène au premier élément quand on dépasse le dernier', () => {
    // C'est l'incident : la tabulation repartait sur les boutons de la page.
    render(<Panneau />);
    ouvrir();
    screen.getByRole('button', { name: 'dernier' }).focus();
    tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'premier' }));
  });

  it('ramène au dernier quand on remonte depuis le premier', () => {
    render(<Panneau />);
    ouvrir();
    screen.getByRole('button', { name: 'premier' }).focus();
    tab({ shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'dernier' }));
  });

  it('laisse circuler librement à l’intérieur', () => {
    // Le piège retient les bords, il ne dirige pas chaque pas : entre deux
    // éléments, c'est le navigateur qui décide, et il le fait bien.
    render(<Panneau />);
    ouvrir();
    const milieu = screen.getByRole('button', { name: 'milieu' });
    milieu.focus();
    tab();
    expect(document.activeElement, 'le piège a détourné une tabulation ordinaire').toBe(milieu);
  });

  it('rattrape un focus parti derrière le voile', () => {
    // Après un clic sur le fond, le focus n'est plus dans la boîte. La
    // tabulation suivante doit y revenir, pas continuer dans la page.
    render(<Panneau />);
    ouvrir();
    screen.getByRole('button', { name: 'derrière le voile' }).focus();
    tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'premier' }));
  });

  it('ne lève pas quand tout le panneau est désactivé', () => {
    // `ConfirmDialog` désactive ses deux boutons pendant un chargement :
    // l'ancienne version appelait alors `.focus()` sur un `undefined`. Un
    // panneau qui tombe pendant qu'il travaille est pire que pas de piège.
    render(<Panneau tousDesactives />);
    ouvrir();
    expect(() => tab()).not.toThrow();
  });
});

describe('Échap ferme', () => {
  it('appelle la fermeture', () => {
    const surFermeture = vi.fn();
    render(<Panneau surFermeture={surFermeture} />);
    ouvrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(surFermeture).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ne ferme rien tant que le panneau n’est pas ouvert', () => {
    const surFermeture = vi.fn();
    render(<Panneau surFermeture={surFermeture} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(surFermeture).not.toHaveBeenCalled();
  });
});

describe('le focus, à l’ouverture et à la fermeture', () => {
  it('se pose sur le premier champ de saisie s’il y en a un', () => {
    // C'est ce que le monteur vient faire : saisir.
    render(<Panneau champ />);
    ouvrir();
    expect(document.activeElement).toBe(screen.getByLabelText('titre'));
  });

  it('se pose sur le premier bouton sinon', () => {
    render(<Panneau />);
    ouvrir();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'premier' }));
  });

  it('revient au bouton qui a ouvert le panneau', () => {
    // La moitié du geste qui manquait aux deux panneaux qui avaient déjà un
    // piège : fermer renvoyait au début du document, et il fallait retraverser
    // tout le studio à la tabulation pour revenir où on en était.
    render(<Panneau />);
    const bouton = screen.getByRole('button', { name: 'ouvrir' });
    bouton.focus();
    ouvrir();
    expect(document.activeElement).not.toBe(bouton);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement, 'le focus n’est pas revenu au bouton d’ouverture').toBe(bouton);
  });

  it('ne force rien quand l’élément appelant a disparu', () => {
    // Un bouton démonté avec le panneau — « Supprimer », par exemple — ne peut
    // plus rien recevoir, et forcer le focus sur un nœud détaché le renverrait
    // au <body> sans prévenir.
    function Ephemere() {
      const [ouvert, setOuvert] = useState(false);
      const boite = usePiegeFocus(ouvert, () => setOuvert(false));
      return (
        <div>
          <button type="button">ancre</button>
          {!ouvert && <button type="button" onClick={() => setOuvert(true)}>ouvrir</button>}
          {ouvert && <div ref={boite} role="dialog"><button type="button">seul</button></div>}
        </div>
      );
    }
    render(<Ephemere />);
    ouvrir();
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
  });
});

describe('ce que le hook considère comme focalisable', () => {
  it('écarte ce qui est désactivé, masqué ou hors du parcours', () => {
    const racine = document.createElement('div');
    racine.innerHTML = `
      <button>oui</button>
      <button disabled>non, désactivé</button>
      <input tabindex="-1" />
      <a>non, sans href</a>
      <a href="#x">oui, lien</a>
      <span aria-hidden="true"><button>non, masqué</button></span>
      <textarea></textarea>`;
    expect(elementsFocalisables(racine).map((e) => e.tagName)).toEqual(['BUTTON', 'A', 'TEXTAREA']);
  });

  it('survit à une boîte qui n’existe pas encore', () => {
    expect(elementsFocalisables(null)).toEqual([]);
    expect(premierFocus(null)).toBeNull();
  });
});

describe('aucun panneau ne repart sans piège', () => {
  // Neuf composants déclarent `role="dialog"`. Deux seulement tenaient la
  // promesse. Ce balayage empêche le dixième d'arriver nu — il lit les
  // sources plutôt que de monter neuf composants, dans l'esprit du test du
  // lot 5 qui interdit les polices en clair.
  const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../src');

  const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? fichiers(join(dossier, e.name)) : (e.name.endsWith('.jsx') ? [join(dossier, e.name)] : [])
  // Le hook lui-même porte un exemple d'usage dans son commentaire d'en-tête :
  // il se compterait comme un onzième panneau.
  )).filter((f) => !f.endsWith('usePiegeFocus.jsx'));

  it('tout ce qui s’annonce modal retient le clavier', () => {
    const nus = fichiers(RACINE)
      .filter((f) => {
        const s = readFileSync(f, 'utf8');
        return s.includes('role="dialog"') && !s.includes('usePiegeFocus');
      })
      .map((f) => f.slice(RACINE.length + 1));
    expect(nus, 'ces panneaux annoncent une boîte modale sans en être une').toEqual([]);
  });

  it('attache bien le piège à sa boîte', () => {
    // Importer le hook ne suffit pas : sans le `ref` sur l'élément qui porte
    // `role="dialog"`, il ne voit rien et laisse la tabulation filer. Un
    // oubli d'une ligne qu'aucun test de comportement ne rattraperait, parce
    // qu'il faudrait monter les dix panneaux pour s'en apercevoir.
    const detaches = [];
    fichiers(RACINE).forEach((f) => {
      const s = readFileSync(f, 'utf8');
      const declarations = [...s.matchAll(/const (\w+) = usePiegeFocus\(/g)].map((m) => m[1]);
      declarations.forEach((nom) => {
        if (!s.includes(`ref={${nom}}`)) detaches.push(`${f.slice(RACINE.length + 1)} → ${nom}`);
      });
    });
    expect(detaches, 'le piège est déclaré mais posé sur rien').toEqual([]);
  });

  it('en couvre bien dix', () => {
    // Un balayage qui ne voit rien passe toujours. Si ce compte tombe, c'est
    // qu'un panneau a disparu — ou que le balayage ne le trouve plus.
    // `= usePiegeFocus(` plutôt que le simple nom : sinon le fichier du hook
    // se compte lui-même.
    const avec = fichiers(RACINE).filter((f) => readFileSync(f, 'utf8').includes('= usePiegeFocus(')).length;
    expect(avec).toBe(10);
  });
});
