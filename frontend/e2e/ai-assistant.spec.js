import { test, expect } from '@playwright/test';

test('AI Assistant button opens chatbot', async ({ page }) => {
  // Listen to console logs
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Mock API routes to bypass login and avoid backend requirement
  await page.route('**/api/auth/check', route => route.fulfill({ status: 200, body: '{"ok":true}' }));
  await page.route('**/api/countries', route => route.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/weeks', route => route.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/uploads/**', route => route.fulfill({ status: 200, body: '{}' }));

  // Navigate to the app
  await page.goto('http://127.0.0.1:5173');
  
  // Wait for the application to load
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#root', { state: 'attached' });
  await page.waitForTimeout(2000); // Wait a bit for React to render

  // Dump the text content of the body
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Page text preview:\n', bodyText);

  // Look for the "Veux-tu savoir comment faire ?" prompt and click it
  await page.locator('text=Veux-tu savoir comment faire').click({ timeout: 5000 }).catch(() => 
    page.locator('.fixed.bottom-6.right-6 button').click({ timeout: 5000 })
  );

  // Verify that the Chatbot window opens by checking for the "Assistant IA" text
  const chatbotTitle = page.locator('text=Assistant IA').first();
  await chatbotTitle.waitFor({ state: 'visible', timeout: 5000 });
  await expect(chatbotTitle).toBeVisible();
});
