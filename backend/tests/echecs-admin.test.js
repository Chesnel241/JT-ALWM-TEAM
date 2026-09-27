import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { TEST_UPLOADS_DIR } from './setup.js';
import {
  creerCompteur,
  estBloque,
  noterEchec,
  secondesRestantes,
} from '../src/middleware/echecsAdmin.js';

/**
 * Le mot de passe montage ne se devine plus à la chaîne.
 *
 * L'INCIDENT : aucune limite ne portait sur les échecs. `/api/auth/check-admin`
 * répondait oui ou non à 100 essais par minute et par adresse — plus de
 * 140 000 par jour — et les autres gardes n'avaient que la limite globale de
 * 500 par minute. Le mot de passe protège la suppression des envois, la
 * publication du JT et l'émission des liens des correspondants.
 *
 * Et la valeur d'exemple de `.env.example`, publique puisqu'elle est dans le
 * dépôt, suffisait à ouvrir l'espace montage d'un serveur qui l'aurait gardée.
 */

const MINUTE = 60 * 1000;

describe('le compteur d’échecs, comme des mathématiques', () => {
  it('bloque au vingtième échec, pas avant', () => {
    const c = creerCompteur({ max: 20, fenetreMs: 15 * MINUTE });
    for (let i = 0; i < 19; i += 1) noterEchec(c, 'a', 1000 + i);
    expect(estBloque(c, 'a', 2000)).toBe(false);
    noterEchec(c, 'a', 2000);
    expect(estBloque(c, 'a', 2001)).toBe(true);
  });

  it('oublie les échecs sortis de la fenêtre', () => {
    const c = creerCompteur({ max: 3, fenetreMs: 15 * MINUTE });
    [0, 1, 2].forEach((t) => noterEchec(c, 'a', t));
    expect(estBloque(c, 'a', 10)).toBe(true);
    expect(estBloque(c, 'a', 15 * MINUTE + 3)).toBe(false);
  });

  it('dit combien de secondes attendre, et zéro quand rien ne bloque', () => {
    const c = creerCompteur({ max: 2, fenetreMs: 15 * MINUTE });
    expect(secondesRestantes(c, 'a', 0)).toBe(0);
    noterEchec(c, 'a', 0);
    noterEchec(c, 'a', 60 * 1000);
    // Le plus ancien des deux derniers échecs sort à 15 min : il reste 14 min.
    expect(secondesRestantes(c, 'a', 61 * 1000)).toBe(14 * 60 - 1);
  });

  it('une adresse bloquée ne bloque pas les autres', () => {
    const c = creerCompteur({ max: 2 });
    noterEchec(c, 'attaquant', 0);
    noterEchec(c, 'attaquant', 1);
    expect(estBloque(c, 'attaquant', 2)).toBe(true);
    expect(estBloque(c, 'monteur', 2)).toBe(false);
  });

  it('garde une mémoire bornée face à une rotation d’adresses', () => {
    const c = creerCompteur({ max: 5, maxAdresses: 3 });
    ['a', 'b', 'c', 'd', 'e'].forEach((ip, i) => noterEchec(c, ip, i));
    expect(c.echecs.size).toBe(3);
    expect([...c.echecs.keys()]).toEqual(['c', 'd', 'e']);
  });
});

describe('le vérificateur commun', () => {
  let auth;
  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_ECHECS_MAX = '20';
    process.env.ADMIN_PASSWORD = 'Montage-Secret';
    auth = await import('../src/middleware/auth.js');
  });
  afterAll(() => {
    process.env.ADMIN_ECHECS_MAX = '10000';
    delete process.env.ADMIN_PASSWORD;
    vi.resetModules();
  });

  it('refuse la valeur d’exemple du dépôt, comme s’il n’y avait pas de mot de passe', () => {
    process.env.ADMIN_PASSWORD = ' Change-Me-Admin-Immediately ';
    try {
      expect(auth.motDePasseAdmin()).toBe('');
      expect(auth.verifierMotDePasseAdmin('change-me-admin-immediately', 'x', 0).verdict).toBe('non-configure');
    } finally {
      process.env.ADMIN_PASSWORD = 'Montage-Secret';
    }
  });

  it('vérifier ne compte jamais : seul `noterEchecAdmin` compte', () => {
    // L'INCIDENT : la vérification comptait elle-même. L'envoi d'un
    // correspondant, qui transportait l'ancien mot de passe global, passait
    // par elle : un « échec » par vidéo, et l'espace montage fermé.
    for (let i = 0; i < 100; i += 1) auth.verifierMotDePasseAdmin('ancien-global', 'correspondant', i);
    expect(auth.verifierMotDePasseAdmin('montage-secret', 'correspondant', 200).verdict).toBe('ok');
  });

  it('après vingt échecs notés, même le bon mot de passe attend — sinon le blocage servirait d’oracle', () => {
    for (let i = 0; i < 20; i += 1) auth.noterEchecAdmin('robot', i);
    const r = auth.verifierMotDePasseAdmin('montage-secret', 'robot', 100);
    expect(r.verdict).toBe('bloque');
    expect(r.attente).toBeGreaterThan(0);
    expect(auth.verifierMotDePasseAdmin('montage-secret', 'robot', 20 + 15 * MINUTE).verdict).toBe('ok');
  });

  it('n’enferme jamais une adresse interne : ce serait enfermer toute l’équipe', () => {
    // Derrière un relais mal déclaré, tout le monde arrive avec l'adresse
    // du relais. La compter bloquerait l'équipe entière pour les fautes d'un
    // seul — ou d'un inconnu.
    for (const interne of ['172.18.0.5', '::ffff:172.18.0.5', '10.0.0.3', '127.0.0.1', '::1', '']) {
      for (let i = 0; i < 30; i += 1) expect(auth.noterEchecAdmin(interne, i)).toBe(false);
      expect(auth.verifierMotDePasseAdmin('montage-secret', interne, 40).verdict).toBe('ok');
    }
  });

  it('reconnaît les adresses internes, et seulement elles', () => {
    ['172.18.0.5', '::ffff:10.1.2.3', '192.168.1.4', '127.0.0.1', '::1', 'fd12:3456::1', 'fe80::1', '']
      .forEach((a) => expect(auth.estAdresseInterne(a), a).toBe(true));
    ['41.202.207.3', '203.0.113.7', '172.32.0.1', '2001:db8::1', '::ffff:41.202.207.3']
      .forEach((a) => expect(auth.estAdresseInterne(a), a).toBe(false));
  });

  it('un en-tête absent n’est pas une tentative', () => {
    for (let i = 0; i < 50; i += 1) auth.verifierMotDePasseAdmin(undefined, 'visiteur', i);
    expect(auth.verifierMotDePasseAdmin('montage-secret', 'visiteur', 60).verdict).toBe('ok');
  });
});

describe('le nombre de relais (TRUST_PROXY)', () => {
  it('un nombre devient un nombre de relais, et non une adresse', async () => {
    // Transmis tel quel, « 2 » était lu par Express comme une adresse IP :
    // le réglage ne pouvait pas marcher.
    const { relaisDeConfiance } = await import('../src/app.js');
    expect(relaisDeConfiance('2')).toBe(2);
    expect(relaisDeConfiance(' 1 ')).toBe(1);
    expect(relaisDeConfiance('')).toBe(1);
    expect(relaisDeConfiance(undefined)).toBe(1);
    expect(relaisDeConfiance('loopback')).toBe('loopback');
  });
});

describe('à travers l’application', () => {
  // Hors mode test, comme admin-guards.test.js : `requireAdmin` laisse tout
  // passer sous NODE_ENV=test.
  let app;
  const MOT_DE_PASSE = 'montage-secret-2026';

  async function monter() {
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    return createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_ECHECS_MAX = '20';
    process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    process.env.REPORTER_ACCESS = 'observe';
    app = await monter();
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_ECHECS_MAX = '10000';
    process.env.REPORTER_ACCESS = 'ouvert';
    delete process.env.ADMIN_PASSWORD;
    vi.resetModules();
  });

  it('check-admin se ferme après vingt échecs, et le dit', async () => {
    for (let i = 0; i < 20; i += 1) {
      const r = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '203.0.113.7').set('X-Admin-Password', 'essai-' + i);
      expect(r.status).toBe(401);
    }
    const bloque = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '203.0.113.7').set('X-Admin-Password', MOT_DE_PASSE);
    expect(bloque.status).toBe(429);
    expect(Number(bloque.headers['retry-after'])).toBeGreaterThan(0);
    expect(bloque.body.code).toBe('TROP_D_ESSAIS');

    // Les actions protégées aussi : c'est le même compteur.
    const action = await request(app).get('/api/liens/etat').set('X-Forwarded-For', '203.0.113.7').set('X-Admin-Password', MOT_DE_PASSE);
    expect(action.status).toBe(429);

    // L'équipe, depuis une autre adresse, n'en voit rien.
    const equipe = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '198.51.100.20').set('X-Admin-Password', MOT_DE_PASSE);
    expect(equipe.status).toBe(200);
  });

  it('l’incident rejoué : vingt-cinq envois portant l’ancien mot de passe global ne ferment rien', async () => {
    // Les navigateurs des correspondants mettaient l'ancien mot de passe
    // global dans les métadonnées TUS (`adminPassword`). Chaque envoi
    // comptait un échec ; au vingtième, l'espace montage refusait le bon mot
    // de passe à toute l'équipe.
    const { authorizeTusUpload } = await import('../src/routes/tus.js');
    const ip = '203.0.113.50';
    for (let i = 0; i < 25; i += 1) {
      const r = authorizeTusUpload({ adminPassword: 'ancien-global', appPassword: 'ancien-global' }, { headers: { 'x-forwarded-for': ip } });
      expect(r.isAdmin).toBe(false);
    }
    const r = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', ip).set('X-Admin-Password', MOT_DE_PASSE);
    expect(r.status).toBe(200);
  });

  it('un mauvais en-tête sur une route de correspondant ne compte pas', async () => {
    const ip = '203.0.113.99';
    const { WEEKS } = await import('../src/data/constants.js');
    const semaine = WEEKS.find((w) => w.status === 'active').id;
    for (let i = 0; i < 25; i += 1) {
      await request(app).delete(`/api/uploads/${semaine}/cm/${randomUUID()}`).set('X-Forwarded-For', ip).set('X-Admin-Password', 'faux');
    }
    const r = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', ip).set('X-Admin-Password', MOT_DE_PASSE);
    expect(r.status).toBe(200);
  });

  it('les actions réservées comptent, comme l’écran de connexion', async () => {
    const ip = '203.0.113.77';
    for (let i = 0; i < 10; i += 1) {
      const r = await request(app).get('/api/liens/etat').set('X-Forwarded-For', ip).set('X-Admin-Password', 'faux');
      expect(r.status).toBe(403);
    }
    for (let i = 0; i < 10; i += 1) {
      const r = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', ip).set('X-Admin-Password', 'faux');
      expect(r.status, `essai ${11 + i}`).toBe(401);
    }
    const r = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', ip).set('X-Admin-Password', MOT_DE_PASSE);
    expect(r.status).toBe(429);
  });

  it('sans adresse de visiteur, ne bloque personne et le dit une fois dans le journal', async () => {
    // Pas de X-Forwarded-For : le serveur ne voit que la boucle locale, comme
    // derrière un relais mal déclaré.
    const { default: logger } = await import('../src/logger/index.js');
    const espion = vi.spyOn(logger, 'warn');
    try {
      for (let i = 0; i < 30; i += 1) {
        const r = await request(app).get('/api/auth/check-admin').set('X-Admin-Password', 'faux');
        expect(r.status).toBe(401);
      }
      const r = await request(app).get('/api/auth/check-admin').set('X-Admin-Password', MOT_DE_PASSE);
      expect(r.status).toBe(200);
      const avertissements = espion.mock.calls.filter(([m]) => String(m).includes('TRUST_PROXY'));
      expect(avertissements).toHaveLength(1);
    } finally {
      espion.mockRestore();
    }
  });

  it('la valeur d’exemple n’ouvre rien : ni l’espace montage, ni ses actions', async () => {
    process.env.ADMIN_PASSWORD = 'change-me-admin-immediately';
    try {
      const gate = await request(app).get('/api/auth/check-admin').set('X-Admin-Password', 'change-me-admin-immediately');
      expect(gate.status).toBe(401);
      const action = await request(app).get('/api/liens/etat').set('X-Admin-Password', 'change-me-admin-immediately');
      expect(action.status).toBe(403);
    } finally {
      process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    }
  });
});

describe('derrière deux relais (Caddy puis nginx), avec TRUST_PROXY=2', () => {
  // La chaîne `X-Forwarded-For` arrive alors en « visiteur, relais ». Avec
  // un seul relais déclaré, le serveur retenait l'adresse du relais — la même
  // pour tous. Avec deux, il retrouve le visiteur, et la limite redevient
  // personnelle.
  let app;
  const MOT_DE_PASSE = 'montage-secret-2026';

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_ECHECS_MAX = '20';
    process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    process.env.TRUST_PROXY = '2';
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_ECHECS_MAX = '10000';
    delete process.env.ADMIN_PASSWORD;
    delete process.env.TRUST_PROXY;
    vi.resetModules();
  });

  it('bloque le visiteur fautif, pas celui qui passe par le même relais', async () => {
    for (let i = 0; i < 20; i += 1) {
      await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '203.0.113.20, 172.18.0.3').set('X-Admin-Password', 'faux');
    }
    const fautif = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '203.0.113.20, 172.18.0.3').set('X-Admin-Password', MOT_DE_PASSE);
    expect(fautif.status).toBe(429);
    const equipe = await request(app).get('/api/auth/check-admin').set('X-Forwarded-For', '203.0.113.21, 172.18.0.3').set('X-Admin-Password', MOT_DE_PASSE);
    expect(equipe.status).toBe(200);
  });
});
