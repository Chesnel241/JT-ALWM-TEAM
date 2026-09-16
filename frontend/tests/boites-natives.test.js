import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Onze boîtes natives, et ce qu'elles coûtaient.
 *
 * `alert()` et `confirm()` bloquent le fil d'exécution du navigateur,
 * ignorent le thème sombre du studio, s'affichent dans la langue du système
 * plutôt que celle choisie, ne sont pas stylables, et sur certains
 * navigateurs de bureau une seconde boîte propose de « ne plus afficher ce
 * message » — après quoi le monteur ne voit plus rien du tout, y compris les
 * questions auxquelles il devait répondre.
 *
 * Sept des onze vivaient dans l'habillage JT, c'est-à-dire en plein studio.
 * La maison a `useToast` pour ce qui informe et `ConfirmDialog` pour ce qui
 * demande, depuis longtemps.
 *
 * Ce test lit les sources plutôt que de monter les écrans : c'est la même
 * forme que celui qui interdit les couleurs codées en dur, et que celui du
 * lot 5 qui interdit les polices en clair.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../src');

const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? fichiers(join(dossier, e.name)) : (/\.jsx?$/.test(e.name) ? [join(dossier, e.name)] : [])
));

describe('les boîtes natives du navigateur', () => {
  it('ne reviennent pas', () => {
    const appels = [];
    fichiers(RACINE).forEach((f) => {
      readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        // Les commentaires en parlent, et c'est voulu : ils rappellent
        // l'incident. Seul le code compte.
        const code = ligne.replace(/\/\/.*/, '');
        if (/(?<![.\w])(alert|confirm|prompt)\s*\(/.test(code) || /window\.(alert|confirm|prompt)\s*\(/.test(code)) {
          appels.push(`${f.slice(RACINE.length + 1)}:${i + 1} → ${code.trim().slice(0, 60)}`);
        }
      });
    });
    expect(appels, 'une boîte native bloque le fil et ignore le thème').toEqual([]);
  });

  it('ont bien été remplacées, et non simplement supprimées', () => {
    // Un `alert()` retiré sans rien à la place, c'est une erreur qui disparaît
    // en silence — pire que la boîte. Les quatre écrans concernés doivent
    // désormais parler par un toast ou par la boîte de la maison.
    const remplaces = ['components/editor/GlobalLayerPanel.jsx', 'components/StatsView.jsx',
                       'components/DashboardView.jsx', 'components/RubriqueView.jsx'];
    remplaces.forEach((chemin) => {
      const source = readFileSync(join(RACINE, chemin), 'utf8');
      expect(/addToast\(|<ConfirmDialog/.test(source), `${chemin} ne dit plus rien`).toBe(true);
    });
  });

  it('déclarent le toast dans le composant qui s’en sert', () => {
    // C'est le défaut que j'ai introduit en remplaçant les alert() :
    // `useOptionalToast` était déclaré dans un sous-composant du fichier, pas
    // dans celui qui appelait `addToast`. Les tests n'exerçaient pas ce
    // chemin ; c'est le navigateur qui l'a dit — « addToast is not defined ».
    //
    // On compare les portées : un fichier qui appelle `addToast` dans N
    // composants doit le déclarer dans ces N composants.
    const manquants = [];
    fichiers(RACINE).forEach((f) => {
      const source = readFileSync(f, 'utf8');
      if (!source.includes('addToast(')) return;
      // Découpage grossier par déclaration de composant : suffisant, car un
      // composant React ne s'imbrique pas dans un autre.
      const bornes = [...source.matchAll(/^(?:export )?(?:default )?function [A-Z]\w*\(/gm)].map((m) => m.index);
      bornes.push(source.length);
      for (let i = 0; i < bornes.length - 1; i += 1) {
        const portee = source.slice(bornes[i], bornes[i + 1]);
        if (/\baddToast\(/.test(portee) && !/= use(Optional)?Toast\(\)/.test(portee)) {
          manquants.push(`${f.slice(RACINE.length + 1)} → ${portee.slice(0, 60).split('(')[0].trim()}`);
        }
      }
    });
    expect(manquants, 'ce composant appelle addToast sans l’avoir déclaré').toEqual([]);
  });
});
