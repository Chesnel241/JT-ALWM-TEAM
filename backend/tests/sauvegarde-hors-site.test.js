import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Les deux scripts de sauvegarde hors machine.
 *
 * POURQUOI ILS EXISTENT
 * ---------------------
 * `DEPLOY_VPS.md` §11 archive le volume `uploads` vers `/var/backups` — sur le
 * même disque. Cela protège d'une fausse manœuvre, pas de la perte du VPS. Or
 * les rushes des correspondants sont irremplaçables : ils arrivent une fois par
 * semaine, depuis sept pays, souvent sur de mauvaises connexions.
 *
 * CE QUE CES TESTS COUVRENT, ET CE QU'ILS NE COUVRENT PAS
 * ------------------------------------------------------
 * Ils exercent la **logique** des scripts avec un `rclone` de doublure : les
 * refus, le garde-fou de source vide, les options passées, les confirmations.
 * C'est là que se logent les accidents de sauvegarde.
 *
 * Ils **ne prouvent pas** qu'un transfert réel aboutit : cela demande un vrai
 * `rclone`, un vrai compte de stockage et un vrai volume Docker. Cette
 * vérification-là se fait sur le VPS, et elle reste obligatoire — une
 * sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde.
 */

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '../../scripts');
const SAUVEGARDE = join(SCRIPTS, 'sauvegarde-hors-site.sh');
const RESTAURATION = join(SCRIPTS, 'restaurer-sauvegarde.sh');

let atelier;

/**
 * Un `rclone` de doublure : il note ce qu'on lui demande dans un journal, et
 * répond ce que le scénario exige. `size --json` est le seul appel dont le
 * script lit la sortie.
 */
function poserDoublure({ fichiers = 12, codeSortie = 0 } = {}) {
  const journal = join(atelier, 'appels.txt');
  const faux = join(atelier, 'rclone');
  writeFileSync(faux, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ${JSON.stringify(journal)}
if [[ "$1" == "size" ]]; then
  printf '{"count":${fichiers},"bytes":123456}\\n'
  exit 0
fi
exit ${codeSortie}
`);
  chmodSync(faux, 0o755);
  return { faux, journal };
}

const lireJournal = (journal) => (existsSync(journal) ? readFileSync(journal, 'utf8') : '');

function lancer(script, { args = [], env = {}, entree = '' } = {}) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    input: entree,
    env: {
      ...process.env,
      HOME: atelier,
      // Un verrou par test : sinon deux tests concurrents se bloquent l'un
      // l'autre et l'échec ressemble à un défaut du script.
      VERROU: join(atelier, 'verrou'),
      ...env,
    },
  });
}

beforeEach(() => {
  atelier = mkdtempSync(join(tmpdir(), 'jt-sauvegarde-'));
  mkdirSync(join(atelier, '.config/rclone'), { recursive: true });
  writeFileSync(join(atelier, '.config/rclone/rclone.conf'), '[r2]\ntype = s3\n');
});

afterEach(() => rmSync(atelier, { recursive: true, force: true }));

describe('la sauvegarde refuse ce qui n’est pas sûr', () => {
  it('s’arrête si aucune destination n’est donnée', () => {
    // Sans `REMOTE`, un script moins prudent construirait un chemin vide et
    // enverrait tout dans un dossier nommé `:courant`.
    const { faux } = poserDoublure();
    const r = lancer(SAUVEGARDE, { env: { REMOTE: '', RCLONE_BIN: faux } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REMOTE/);
  });

  it('s’arrête quand la source est anormalement vide', () => {
    // LE garde-fou du script. `sync` recopie l'état de la source : si le
    // volume ne se monte pas et se présente vide, la destination se viderait
    // à son tour. Une source vide est un symptôme, pas une instruction.
    const { faux, journal } = poserDoublure({ fichiers: 0 });
    const r = lancer(SAUVEGARDE, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux, PLANCHER: '1' } });

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/vide/i);
    expect(lireJournal(journal), 'une synchronisation a été lancée malgré la source vide').not.toMatch(/sync/);
  });

  it('respecte un plancher plus exigeant', () => {
    // Sur une installation qui porte des centaines de rushes, tomber à trois
    // fichiers est déjà une anomalie. Le plancher se règle.
    const { faux, journal } = poserDoublure({ fichiers: 3 });
    const r = lancer(SAUVEGARDE, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux, PLANCHER: '50' } });
    expect(r.status).not.toBe(0);
    expect(lireJournal(journal)).not.toMatch(/sync/);
  });

  it('échoue bruyamment quand le transfert échoue', () => {
    // Une sauvegarde qui échoue en silence est pire que pas de sauvegarde :
    // on croit être protégé. Le code de sortie non nul est ce que cron et la
    // supervision regardent.
    const { faux } = poserDoublure({ codeSortie: 1 });
    const r = lancer(SAUVEGARDE, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/synchronisation a échoué/i);
  });
});

describe('ce que la sauvegarde envoie vraiment', () => {
  it('écarte les suppressions dans un dossier daté au lieu de les propager', () => {
    // `sync` supprime à la destination ce qui a disparu à la source. Sans
    // `--backup-dir`, une suppression accidentelle — ou malveillante — serait
    // fidèlement recopiée, et la sauvegarde ne servirait plus à rien.
    const { faux, journal } = poserDoublure();
    const r = lancer(SAUVEGARDE, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });

    expect(r.status).toBe(0);
    const appels = lireJournal(journal);
    expect(appels).toMatch(/sync \/data r2:coffre\/courant/);
    expect(appels, 'les suppressions ne sont pas mises de côté').toMatch(/--backup-dir r2:coffre\/versions\/\d{4}-\d{2}-\d{2}T/);
  });

  it('copie l’index à part, daté', () => {
    // `store.json` est petit et c'est l'index de tout le reste : quelles
    // semaines, quels pays, quel fichier appartient à quel reportage. Sans
    // lui, les vidéos restaurées sont un tas de fichiers anonymes.
    const { faux, journal } = poserDoublure();
    lancer(SAUVEGARDE, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });
    expect(lireJournal(journal)).toMatch(/copyto \/data\/store\.json r2:coffre\/etat\/store-\d{4}-\d{2}-\d{2}T.*\.json/);
  });

  it('n’écrit rien en mode essai', () => {
    // De quoi vérifier une configuration neuve sans toucher au coffre.
    const { faux, journal } = poserDoublure();
    const r = lancer(SAUVEGARDE, { args: ['--essai'], env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });

    expect(r.status).toBe(0);
    const appels = lireJournal(journal);
    expect(appels).toMatch(/--dry-run/);
    expect(appels, 'l’index a été copié alors qu’on demandait un essai').not.toMatch(/copyto/);
  });

  it('monte le volume en lecture seule', () => {
    // Une sauvegarde ne doit pas pouvoir abîmer ce qu'elle sauvegarde. Le
    // montage passe par `docker`, pas par rclone : on lit la source du script,
    // comme les autres balayages de la maison.
    const source = readFileSync(SAUVEGARDE, 'utf8');
    expect(source).toMatch(/-v "\$\{VOLUME\}:\/data:ro"/);
  });
});

describe('la restauration protège la production', () => {
  it('vise un volume jetable par défaut', () => {
    // Écraser les données vivantes en croyant faire un essai est l'accident
    // classique — et il arrive le jour où l'on est pressé.
    const { faux, journal } = poserDoublure();
    const r = lancer(RESTAURATION, {
      env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux, VOLUME: 'prod_volume', VOLUME_ESSAI: 'essai_volume' },
    });

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/essai_volume/);
    expect(r.stdout, 'la production est nommée comme cible').not.toMatch(/Copie .* → prod_volume/);
  });

  it('exige une confirmation tapée à la main pour la production', () => {
    const { faux, journal } = poserDoublure();
    const r = lancer(RESTAURATION, {
      args: ['--sur-la-production'],
      env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux },
      entree: 'oui\n',
    });

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Confirmation refusée/);
    expect(lireJournal(journal), 'une copie a démarré malgré le refus').not.toMatch(/copy /);
  });

  it('accepte la phrase exacte, et seulement elle', () => {
    const { faux, journal } = poserDoublure();
    const r = lancer(RESTAURATION, {
      args: ['--sur-la-production'],
      env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux, VOLUME: 'prod_volume' },
      entree: 'restaurer la production\n',
    });

    expect(r.status).toBe(0);
    expect(lireJournal(journal)).toMatch(/copy r2:coffre\/courant \/data/);
  });

  it('copie sans jamais supprimer dans la cible', () => {
    // `copy` et non `sync` : une restauration ne doit pas pouvoir détruire ce
    // qu'elle trouve. Si on se trompe de sauvegarde, on ajoute des fichiers —
    // on n'efface pas ceux qui restaient.
    const { faux, journal } = poserDoublure();
    lancer(RESTAURATION, { env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });
    const appels = lireJournal(journal);
    expect(appels).toMatch(/^copy /m);
    expect(appels, 'la restauration utilise sync : elle peut supprimer').not.toMatch(/^sync /m);
  });

  it('sait lister ce qu’il y a à restaurer', () => {
    // On ne restaure pas à l'aveugle : d'abord voir ce que le coffre contient.
    const { faux, journal } = poserDoublure();
    const r = lancer(RESTAURATION, { args: ['--lister'], env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });

    expect(r.status).toBe(0);
    const appels = lireJournal(journal);
    expect(appels).toMatch(/size r2:coffre\/courant/);
    expect(appels).toMatch(/lsf r2:coffre\/etat\//);
    expect(appels, 'lister a déclenché une copie').not.toMatch(/copy /);
  });

  it('refuse une option qu’il ne connaît pas', () => {
    // Une faute de frappe sur `--sur-la-production` ne doit pas se traduire
    // par une restauration silencieuse ailleurs.
    const { faux } = poserDoublure();
    const r = lancer(RESTAURATION, { args: ['--sur-la-prod'], env: { REMOTE: 'r2:coffre', RCLONE_BIN: faux } });
    expect(r.status).toBe(2);
  });
});
