import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, '../../uploads/webpush_subscriptions.json');

// Le module garde un cache mémoire : on le réimporte à neuf à chaque test.
async function freshStore() {
  vi.resetModules();
  return import('../src/data/webpushSubscriptions.js');
}

function sub(endpoint) {
  return { endpoint, keys: { auth: 'a', p256dh: 'p' } };
}

beforeEach(async () => {
  if (existsSync(FILE_PATH)) await fs.rm(FILE_PATH);
});

describe('abonnements push — ciblage par équipe', () => {
  it('sépare les monteurs des correspondants', async () => {
    const store = await freshStore();
    await store.addSubscription(sub('e-editor'), { audience: 'editor' });
    await store.addSubscription(sub('e-reporter'), { audience: 'reporter', countryId: 'ga' });

    const editors = store.getSubscriptions({ audiences: ['editor'] });
    expect(editors).toHaveLength(1);
    expect(editors[0].subscription.endpoint).toBe('e-editor');

    const reporters = store.getSubscriptions({ audiences: ['reporter'] });
    expect(reporters).toHaveLength(1);
    expect(reporters[0].countryId).toBe('ga');
  });

  it('cible un seul pays', async () => {
    const store = await freshStore();
    await store.addSubscription(sub('ga'), { audience: 'reporter', countryId: 'ga' });
    await store.addSubscription(sub('ci'), { audience: 'reporter', countryId: 'ci' });

    const only = store.getSubscriptions({ audiences: ['reporter'], countryId: 'ga' });
    expect(only.map((e) => e.subscription.endpoint)).toEqual(['ga']);
  });

  it('sans filtre, tout le monde est visé', async () => {
    const store = await freshStore();
    await store.addSubscription(sub('a'), { audience: 'editor' });
    await store.addSubscription(sub('b'), { audience: 'reporter' });
    expect(store.getSubscriptions()).toHaveLength(2);
  });

  it('range une équipe inconnue dans « unknown » plutôt que de la croire', async () => {
    const store = await freshStore();
    await store.addSubscription(sub('x'), { audience: 'admin-supreme' });
    expect(store.getSubscriptions({ audiences: ['unknown'] })).toHaveLength(1);
    expect(store.getSubscriptions({ audiences: ['editor'] })).toHaveLength(0);
  });

  it('ignore un identifiant de pays mal formé', async () => {
    const store = await freshStore();
    await store.addSubscription(sub('x'), { audience: 'reporter', countryId: '../etc' });
    expect(store.getSubscriptions({ audiences: ['reporter'] })[0].countryId).toBe('');
  });

  it('relit les abonnements de l\'ancien format sans contexte', async () => {
    // Fichier écrit par la version précédente : l'objet EST l'abonnement.
    await fs.mkdir(dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify({ legacy: sub('legacy') }, null, 2));

    const store = await freshStore();
    await store.initWebPushDb();

    // Ils restent joignables pour ce qui concerne tout le monde…
    expect(store.getSubscriptions()).toHaveLength(1);
    expect(store.getSubscriptions({ audiences: ['unknown'] })).toHaveLength(1);
    // …et ne reçoivent plus le détail du travail de l'équipe montage.
    expect(store.getSubscriptions({ audiences: ['editor'] })).toHaveLength(0);
  });
});
