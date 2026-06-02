import { test, expect } from '@playwright/test';

// Mocks d'API minimaux pour piloter le SPA sans backend.
async function mock(page) {
  await page.route('**/api/auth/check', (r) => r.fulfill({ status: 200, body: '{"ok":true}' }));
  await page.route('**/api/countries', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { id: 'sn', name: 'Sénégal', code: 'SN' },
      { id: 'ci', name: "Côte d'Ivoire", code: 'CI' },
    ]),
  }));
  await page.route('**/api/weeks', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: '2026-w22', status: 'active', label: 'Semaine 22' }]),
  }));
  await page.route('**/api/uploads/2026-w22', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({}),
  }));
  await page.route('**/api/notifications/**', (r) => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/themes', (r) => r.fulfill({ status: 200, body: '[]' }));
}

test('app boote + #root est monté', async ({ page }) => {
  await mock(page);
  await page.goto('http://127.0.0.1:5175');
  await page.waitForSelector('#root', { state: 'attached' });
  await page.waitForLoadState('networkidle');
  const rootHtml = await page.locator('#root').innerHTML();
  expect(rootHtml.length).toBeGreaterThan(50);
});

test('navigation Espace Reportages / Montage / JT Prêt visible', async ({ page }) => {
  await mock(page);
  await page.goto('http://127.0.0.1:5175');
  await page.waitForLoadState('networkidle');
  // Au moins un des labels d'onglet doit apparaître (la nav reste dans le DOM).
  const labels = ['Espace Reportages', 'Espace Montage', 'JT Prêt'];
  let visibleCount = 0;
  for (const l of labels) {
    if (await page.getByText(l).first().isVisible().catch(() => false)) visibleCount++;
  }
  expect(visibleCount).toBeGreaterThanOrEqual(1);
});

test('aucune erreur JS console au boot', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await mock(page);
  await page.goto('http://127.0.0.1:5175');
  await page.waitForLoadState('networkidle');
  // Filtre les warnings React DevTools / favicon manquant.
  const real = errors.filter((e) =>
    !/React DevTools|Download the React|favicon|preload .+ was preloaded/i.test(e)
  );
  expect(real, real.join('\n')).toEqual([]);
});
