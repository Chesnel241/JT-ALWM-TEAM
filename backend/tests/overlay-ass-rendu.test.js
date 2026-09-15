import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateAssFile, OVERLAY_TEMPLATES } from '../src/data/overlayTemplates.js';

/**
 * Le plan de repli doit fonctionner, sinon ce n'est pas un plan de repli.
 *
 * `generateAssFile` appelait `template.buildAss(...)`, une propriété qu'aucun
 * des 23 modèles ne possède depuis une réécriture du catalogue. Toute liste
 * d'habillages non vide levait donc une TypeError : côté clip elle était
 * avalée et les titres disparaissaient sans un mot, côté habillage global elle
 * faisait échouer l'assemblage entier du master.
 *
 * Les tests existants ne passaient qu'un tableau vide — des sous-titres, sans
 * aucun habillage. La panne était invisible pour l'intégration continue. Ce
 * fichier ne passe que des listes remplies.
 *
 * `libass` reste le repli documenté (docs/CLOUD_RUN.md) ; la référence
 * visuelle est Remotion. On vérifie ici qu'il produit un JT regardable, pas
 * qu'il imite Remotion au pixel.
 */

let dossier;

beforeAll(() => {
  dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-ass-'));
});

afterAll(() => {
  fs.rmSync(dossier, { recursive: true, force: true });
});

function rendre(overlays, sousTitres = null) {
  const chemin = generateAssFile(overlays, dossier, {}, sousTitres);
  return fs.readFileSync(chemin, 'utf8');
}

function dialogues(contenu) {
  return contenu.split('\n').filter((l) => l.startsWith('Dialogue:'));
}

function positions(contenu) {
  return dialogues(contenu)
    .map((l) => /\\pos\((-?\d+),(-?\d+)\)/.exec(l))
    .filter(Boolean)
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

describe('un habillage non vide', () => {
  it('ne fait plus échouer la génération', () => {
    // C'est le test qui manquait. Sans lui, « template.buildAss is not a
    // function » est parti en production.
    expect(() => rendre([
      { templateId: 'titre_reportage', fields: { titre: 'Le marché de Douala', sous_titre: 'Cameroun' } },
    ])).not.toThrow();
  });

  it('écrit le texte saisi, pas un texte de remplacement', () => {
    const ass = rendre([
      { templateId: 'titre_reportage', fields: { titre: 'Le marché de Douala', sous_titre: 'Cameroun' } },
    ]);
    expect(ass).toContain('Le marché de Douala');
    expect(ass).toContain('Cameroun');
  });

  it('rend chaque modèle du catalogue sans lever', () => {
    // Un seul modèle cassé suffit à faire échouer un master entier : on les
    // parcourt tous plutôt que d'en choisir un représentatif.
    OVERLAY_TEMPLATES.forEach((modele) => {
      const fields = Object.fromEntries(modele.fields.map((f) => [f.key, `Valeur ${f.key}`]));
      expect(() => rendre([{ templateId: modele.id, fields }]), modele.id).not.toThrow();
    });
  });

  it('produit au moins une ligne par champ rempli', () => {
    const ass = rendre([
      { templateId: 'envato_presenter', fields: { context: 'JT ALWM', name: 'Awa Diop', title: 'Correspondante' } },
    ]);
    expect(dialogues(ass)).toHaveLength(3);
  });

  it('ignore les champs laissés vides', () => {
    const ass = rendre([
      { templateId: 'titre_reportage', fields: { titre: 'Seul le titre', sous_titre: '' } },
    ]);
    expect(dialogues(ass)).toHaveLength(1);
  });

  it('ne rend rien du tout quand aucun champ n’est rempli', () => {
    // Mieux vaut pas de bandeau qu'un bandeau vide à l'antenne.
    const ass = rendre([{ templateId: 'titre_reportage', fields: {} }]);
    expect(dialogues(ass)).toHaveLength(0);
  });
});

describe('le texte reste dans l’image', () => {
  it('ne descend jamais sous le bord bas', () => {
    // L'empilement naïf vers le bas plaçait le sous-titre d'un bandeau ancré
    // à y=1000 sur la ligne 1073 : invisible, dans une image qui s'arrête
    // à 1080.
    const ass = rendre([
      { templateId: 'titre_reportage', fields: { titre: 'Un titre', sous_titre: 'Un sous-titre' } },
    ]);
    positions(ass).forEach((p) => {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1040);
    });
  });

  it('garde dans l’image un habillage à trois champs ancré en bas', () => {
    const ass = rendre([
      { templateId: 'envato_presenter', fields: { context: 'JT ALWM', name: 'Awa Diop', title: 'Correspondante' } },
    ]);
    positions(ass).forEach((p) => expect(p.y).toBeLessThanOrEqual(1040));
  });

  it('centre un habillage plein écran au lieu de l’empiler vers le bas', () => {
    const ass = rendre([{ templateId: 'envato_big_title', fields: { titre: 'Sommet africain' } }]);
    const [p] = positions(ass);
    expect(p.x).toBe(960);
    expect(p.y).toBeGreaterThan(400);
    expect(p.y).toBeLessThan(700);
  });

  it('tient même avec une taille de police poussée au maximum', () => {
    const ass = rendre([
      { templateId: 'envato_presenter', fontSize: 250, fields: { context: 'A', name: 'B', title: 'C' } },
    ]);
    positions(ass).forEach((p) => {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1040);
    });
  });
});

describe('ce que le texte du monteur ne peut pas casser', () => {
  it('neutralise les accolades et antislashs d’une saisie', () => {
    // Le texte du monteur voyage dans un format où les accolades ouvrent une
    // balise : sans échappement, un titre pourrait réécrire l'habillage.
    const ass = rendre([
      { templateId: 'titre_reportage', fields: { titre: '{\\pos(0,0)\\c&HFF0000&}Pirate' } },
    ]);
    const ligne = dialogues(ass)[0];
    const corps = ligne.slice(ligne.indexOf('}') + 1);
    expect(corps).not.toContain('{');
    expect(corps).not.toContain('\\');
    expect(corps).toContain('Pirate');
  });

  it('ne casse pas sur un habillage dont le modèle est inconnu', () => {
    expect(() => rendre([{ templateId: 'modele_qui_nexiste_pas', fields: { titre: 'X' } }])).not.toThrow();
  });
});

describe('habillages et sous-titres ensemble', () => {
  it('écrit les deux dans le même fichier', () => {
    // Le cas réel : un titre de reportage et les sous-titres automatiques.
    const ass = rendre(
      [{ templateId: 'titre_reportage', fields: { titre: 'Le marché de Douala' } }],
      [{ start: 1, end: 3, text: 'Bonsoir à tous.' }]
    );
    expect(ass).toContain('Le marché de Douala');
    expect(ass).toContain('Bonsoir à tous.');
    expect(dialogues(ass)).toHaveLength(2);
  });
});
