import { test, expect } from '@playwright/test';

test.describe('AI Assistant Tour Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    
    // Add API mocking
    await page.route('**/api/**', async (route) => {
      if (route.request().resourceType() !== 'fetch' && route.request().resourceType() !== 'xhr') {
        return route.continue();
      }
      
      const url = route.request().url();
      if (url.includes('/api/auth/check')) {
        await route.fulfill({ status: 200, json: { ok: true } });
      } else if (url.includes('/api/countries')) {
        await route.fulfill({ status: 200, json: [{ id: 'cg', name: 'Congo', code: 'CG' }, { id: 'fr', name: 'France', code: 'FR' }] });
      } else if (url.includes('/api/weeks')) {
        await route.fulfill({ status: 200, json: [{ id: 'S12-2026', label: 'S12-2026', status: 'active' }] });
      } else if (url.includes('/api/uploads/voiceover')) {
        await route.fulfill({ status: 200, json: [] });
      } else if (url.includes('/api/uploads')) {
        await route.fulfill({ status: 200, json: { 'cg': [] } });
      } else if (url.includes('/api/deliveries')) {
        await route.fulfill({ status: 200, json: [] });
      } else {
        await route.fulfill({ status: 200, json: {} });
      }
    });

    // Navigate to the app and bypass the password screen if any
    await page.goto('/');
    
    // Attempt to bypass auth if present
    const authInput = page.locator('input[type="password"]');
    if (await authInput.isVisible()) {
      await authInput.fill('jesuisledirecteur'); // Use a generic or correct password if needed
      await page.locator('button[type="submit"]').click();
    }
  });

  const testTourOnTab = async (page, tabName, buttonTextOrSelector) => {
    // Navigate to the tab
    if (buttonTextOrSelector) {
      if (typeof buttonTextOrSelector === 'string' && buttonTextOrSelector.startsWith('nav')) {
         // Special handling if needed
      } else {
         const btn = page.locator(buttonTextOrSelector).first();
         await btn.waitFor({ state: 'visible' });
         await btn.click();
      }
    }
    
    // Wait for the AI Assistant floating button to appear (it has a fixed size w-14 h-14)
    const chatToggleBtn = page.locator('button.w-14.h-14').first();
    try {
      await chatToggleBtn.waitFor({ state: 'visible', timeout: 5000 });
    } catch (err) {
      console.log('Timeout waiting for chat toggle. DOM:', await page.content());
      throw err;
    }
    
    // Open the chat
    await chatToggleBtn.click();
    
    // Click the "Visite guidée" or "Start Guided Tour" button inside the chat
    const tourBtn = page.locator('button').filter({ hasText: /visite guidée|visual guide/i }).first();
    await tourBtn.waitFor({ state: 'visible', timeout: 5000 });
    await tourBtn.click();
    
    // The tour tooltip should appear
    await page.screenshot({ path: 'test-results/debug-' + tabName + '-tour-start.png' });

    const tooltip = page.locator('.__floater__body, .react-joyride__tooltip').first();
    await tooltip.waitFor({ state: 'visible', timeout: 5000 });
    // We should be able to click "Next" or "Suivant" until finished or skipped
    let hasNext = true;
    let stepCount = 0;
    while (hasNext && stepCount < 10) {
      stepCount++;
      await page.waitForTimeout(1000); // Give Joyride time to animate
      
      const tooltip = page.locator('.__floater__body, .react-joyride__tooltip').first();
      
      if (await tooltip.isVisible()) {
        const nextBtn = tooltip.locator('button[aria-label="Next"], button[aria-label="Last"], button:has-text("Suivant"), button:has-text("Next"), button:has-text("Terminer"), button:has-text("Finish")').first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
        } else {
          const closeBtn = tooltip.locator('button[aria-label="Close"], button:has-text("Fermer"), button:has-text("Close"), button[title="Fermer"]').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          } else {
            const anyBtn = tooltip.locator('button').last();
            if (await anyBtn.isVisible()) {
              await anyBtn.click();
            }
          }
          hasNext = false;
        }
      } else {
        // Tooltip is no longer visible, tour must be done
        hasNext = false;
      }
    }
    

    
    // Verify no dark screen artifact remains
    const spotlight = page.locator('.react-joyride__spotlight');
    await expect(spotlight).toHaveCount(0);
  };

  test('Test AI Tour on Home Tab', async ({ page }) => {
    await testTourOnTab(page, 'Home', null); // Already on home
  });

  test('Test AI Tour on Espace Montage (Dashboard)', async ({ page }) => {
    // In Header navigation
    await testTourOnTab(page, 'Dashboard', '#tour-nav-editing');
  });

  test('Test AI Tour on JT Prêt (Delivery)', async ({ page }) => {
    await testTourOnTab(page, 'Delivery', '#tour-nav-delivery');
  });

  test('Test AI Tour on Voix Off', async ({ page }) => {
    await testTourOnTab(page, 'Voix Off', 'button:has-text("Voix Off")');
  });
});
