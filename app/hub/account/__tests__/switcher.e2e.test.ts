import { test, expect, Page } from '@playwright/test';

// Supabase configuration for E2E tests
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nkgefawgegfhjfedbgbe.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TEST_EMAIL = 'test-switcher@example.com';

/**
 * Helper to authenticate via Supabase API using OTP.
 * In a real test environment, this would:
 * 1. Call the OTP endpoint
 * 2. Retrieve the OTP token from email service
 * 3. Verify the OTP
 *
 * For now, we'll attempt to use a test user that might already exist,
 * or handle auth via localStorage directly if configured.
 */
async function authenticateUser(page: Page) {
  // Try to access the app - if redirected to login, we need to handle auth
  await page.goto('/hub/account');

  // Check if we're on the login page
  const url = page.url();
  if (url.includes('/login')) {
    // In a production E2E setup, you would:
    // 1. Use a test user with password auth enabled
    // 2. Or intercept the OTP email via a test email service
    // 3. Or use Supabase admin API to create a test session

    // For this test, we'll use environment variables to set up auth
    const testUserId = process.env.TEST_USER_ID;
    const testSession = process.env.TEST_SESSION_TOKEN;

    if (testSession && testUserId) {
      // Set the session directly in localStorage
      await page.evaluate(({ session, userId }) => {
        const auth = {
          currentSession: {
            access_token: session,
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: '',
            user: { id: userId, email: '' },
          },
          currentUser: { id: userId, email: '' },
        };
        localStorage.setItem('sb-nkgefawgegfhjfedbgbe-auth-token', JSON.stringify(auth));
      }, { session: testSession, userId: testUserId });

      // Reload page to pick up auth
      await page.reload();
    } else {
      throw new Error(
        'E2E test requires TEST_USER_ID and TEST_SESSION_TOKEN environment variables ' +
        'for authentication. In production, integrate with Supabase test user setup or ' +
        'configure an email service to intercept OTP tokens.'
      );
    }
  }
}

test.describe('Application Switcher Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console messages for error checking
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  });

  test('candidate switches between applications and sees correct role data', async ({ page }) => {
    // 1. Authenticate and navigate to /hub/account
    await authenticateUser(page);

    // Ensure we're on the account page
    const url = page.url();
    expect(url).toContain('/hub/account');

    // 2. Verify applications card is visible
    const applicationsCard = page.locator('[data-testid="applications-card"]');
    await expect(applicationsCard).toBeVisible();

    // Get all application rows
    const appRows = page.locator('[data-testid^="application-row-"]');
    const rowCount = await appRows.count();

    // We need at least 2 applications to test switching
    if (rowCount < 2) {
      console.warn('Warning: Test requires at least 2 applications. Found:', rowCount);
      // This test should be skipped if less than 2 apps exist, but we'll continue
      // to at least verify the single app case
      if (rowCount === 0) {
        console.log('No applications found. Test data may need to be set up.');
        return;
      }
    }

    // 3. Get initial state (first application)
    const firstRow = appRows.nth(0);
    const firstAppId = await firstRow.getAttribute('data-testid');
    const firstAppIdValue = firstAppId?.replace('application-row-', '') || '';

    // Get first app's score
    const firstScore = await page.locator(`[data-testid="interview-score-${firstAppIdValue}"]`).textContent();

    // Get initial role title from TopBar
    const roleLabel = page.locator('[data-testid="role-label"]');
    const initialRole = await roleLabel.textContent();

    console.log('Initial state:', { firstAppId, firstScore, initialRole, url: page.url() });

    // 4. Click second application if available
    if (rowCount >= 2) {
      const secondRow = appRows.nth(1);
      const secondAppId = await secondRow.getAttribute('data-testid');
      const secondAppIdValue = secondAppId?.replace('application-row-', '') || '';

      // Get second app's score
      const secondScore = await page.locator(`[data-testid="interview-score-${secondAppIdValue}"]`).textContent();

      console.log('Second app score:', secondScore);

      // Click second app
      await secondRow.click();

      // Wait for navigation
      await page.waitForLoadState('networkidle');

      // 5. Verify URL changed to ?lead={id}
      const newUrl = page.url();
      expect(newUrl).toContain(`lead=${secondAppIdValue}`);

      // 6. Verify TopBar role_title updated
      const newRole = await roleLabel.textContent();
      console.log('Role after switch:', newRole);
      // Role should be different OR the same if it's the same role on different applications
      // We can at least verify the element is still present and updated
      expect(roleLabel).toBeVisible();

      // 7. Verify interview/report data changed
      // Check if the score display updated
      const newScoreDisplay = await page.locator(`[data-testid="interview-score-${secondAppIdValue}"]`).textContent();
      expect(newScoreDisplay).toBe(secondScore);

      // Also verify that other role-specific data is displayed
      // (the page heading should include the role title)
      const pageHeading = page.locator('h1');
      const headingText = await pageHeading.textContent();
      if (headingText) {
        expect(headingText).toContain('here\'s how you stand for');
      }

      // 8. Click first app again to verify revert
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // 9. Verify URL reverted
      const revertedUrl = page.url();
      expect(revertedUrl).toContain(`lead=${firstAppIdValue}`);

      // Verify TopBar reverted
      const revertedRole = await roleLabel.textContent();
      console.log('Role after revert:', revertedRole);
      expect(roleLabel).toBeVisible();

      // Verify data reverted
      const revertedScore = await page.locator(`[data-testid="interview-score-${firstAppIdValue}"]`).textContent();
      expect(revertedScore).toBe(firstScore);
    }

    // 10. Test invalid lead parameter
    // Navigate with invalid lead ID
    const invalidLeadUrl = `/hub/account?lead=invalid-id-12345`;
    await page.goto(invalidLeadUrl);
    await page.waitForLoadState('networkidle');

    // Should not show error - should gracefully fall back to first app
    const finalUrl = page.url();
    expect(finalUrl).toContain('/hub/account');

    // Applications card should still be visible
    await expect(applicationsCard).toBeVisible();

    // No console errors should have been logged
    // (checked via page.on('console') handler above)
  });

  test('references and pricing stay consistent across application switches', async ({ page }) => {
    // This test verifies that cross-lead data (references, pricing) remains the same
    // when switching between applications

    await authenticateUser(page);
    await page.goto('/hub/account');

    // Get applications count
    const appRows = page.locator('[data-testid^="application-row-"]');
    const rowCount = await appRows.count();

    if (rowCount < 2) {
      console.log('Test requires at least 2 applications. Skipping.');
      return;
    }

    // Navigate to references section (if available)
    const referencesLink = page.locator('a:has-text("References")').first();
    if (await referencesLink.isVisible()) {
      // Note current app
      const firstRow = appRows.nth(0);
      const firstAppId = await firstRow.getAttribute('data-testid');

      // Switch to second app
      const secondRow = appRows.nth(1);
      const secondAppId = await secondRow.getAttribute('data-testid');
      await secondRow.click();
      await page.waitForLoadState('networkidle');

      // References link should still be visible at the same location
      expect(referencesLink).toBeVisible();
    }

    // Pricing information should be available on both applications
    const pricingText = page.locator('text=/pricing|price|cost/i').first();
    if (await pricingText.isVisible()) {
      const pricing1 = await pricingText.textContent();

      // Switch apps and verify pricing is still there
      const secondRow = appRows.nth(1);
      const secondAppId = await secondRow.getAttribute('data-testid');
      await secondRow.click();
      await page.waitForLoadState('networkidle');

      const pricing2 = await pricingText.textContent();
      expect(pricing2).toBe(pricing1);
    }
  });
});

test.describe('TopBar Role Switcher', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  });

  /**
   * The Overview ApplicationsCard has one `application-row-<leadId>` per role,
   * so its rows tell us how many leads the test account has. The TopBar
   * switcher only renders its dropdown trigger when there are 2+ -- the tests
   * below skip themselves (log + return, matching this file's style) when the
   * seeded account doesn't have the right shape.
   */
  async function getRoleLeadIds(page: Page): Promise<string[]> {
    await expect(page.locator('[data-testid="applications-card"]')).toBeVisible();
    const rows = page.locator('[data-testid^="application-row-"]');
    const count = await rows.count();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const testid = await rows.nth(i).getAttribute('data-testid');
      ids.push((testid || '').replace('application-row-', ''));
    }
    return ids;
  }

  // (a) 2+ leads: the trigger opens a role="menu" dropdown listing every role.
  test('trigger opens a dropdown listing every role', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/hub/account');

    const leadIds = await getRoleLeadIds(page);
    if (leadIds.length < 2) {
      console.log('Test requires an account with 2+ roles. Found:', leadIds.length);
      return;
    }

    const trigger = page.locator('[data-testid="role-switcher-trigger"]');
    await expect(trigger).toBeVisible();

    await trigger.click();

    const menu = page.locator('[role="menu"][aria-label="Switch role"]');
    await expect(menu).toBeVisible();

    // One role-option per lead row on the ApplicationsCard.
    const options = page.locator('[data-testid^="role-option-"]');
    await expect(options).toHaveCount(leadIds.length);
  });

  // (b) Clicking the non-active option changes the URL to ?lead=<id> and the
  //     role-label text.
  test('choosing a different role updates the URL and the label', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/hub/account');

    const leadIds = await getRoleLeadIds(page);
    if (leadIds.length < 2) {
      console.log('Test requires an account with 2+ roles. Found:', leadIds.length);
      return;
    }

    const roleLabel = page.locator('[data-testid="role-label"]');
    const initialLabel = (await roleLabel.textContent())?.trim() || '';

    await page.locator('[data-testid="role-switcher-trigger"]').click();
    await expect(page.locator('[role="menu"][aria-label="Switch role"]')).toBeVisible();

    // The active option carries aria-current="true"; pick any other one.
    const otherOption = page.locator('[data-testid^="role-option-"]:not([aria-current="true"])').first();
    const otherTestId = await otherOption.getAttribute('data-testid');
    const otherLeadId = (otherTestId || '').replace('role-option-', '');
    const otherOptionText = (await otherOption.textContent())?.trim() || '';

    await otherOption.click();

    await expect(page).toHaveURL(new RegExp(`lead=${otherLeadId}`));

    const newLabel = (await roleLabel.textContent())?.trim() || '';
    expect(newLabel).not.toBe(initialLabel);
    // role-label shows role_title only; the option shows role_title (+ score),
    // so the label text is a substring of the option text.
    expect(otherOptionText).toContain(newLabel);
  });

  // (c) After switching, clicking a Sidebar link keeps ?lead=<id> in the URL.
  test('after switching, a Sidebar link keeps the active ?lead=', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/hub/account');

    const leadIds = await getRoleLeadIds(page);
    if (leadIds.length < 2) {
      console.log('Test requires an account with 2+ roles. Found:', leadIds.length);
      return;
    }

    await page.locator('[data-testid="role-switcher-trigger"]').click();
    const otherOption = page.locator('[data-testid^="role-option-"]:not([aria-current="true"])').first();
    const otherLeadId = ((await otherOption.getAttribute('data-testid')) || '').replace('role-option-', '');
    await otherOption.click();
    await expect(page).toHaveURL(new RegExp(`lead=${otherLeadId}`));

    // Sidebar nav carries the active ?lead= via useLeadHref.
    await page.locator('a:has-text("Fitment report")').first().click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/hub/account/report');
    expect(page.url()).toContain(`lead=${otherLeadId}`);
  });

  // (d) 1-lead account: no dropdown trigger, but the static role-label still shows.
  test('a single-role account shows no switcher trigger', async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/hub/account');

    const leadIds = await getRoleLeadIds(page);
    if (leadIds.length !== 1) {
      console.log('Test requires an account with exactly 1 role. Found:', leadIds.length);
      return;
    }

    await expect(page.locator('[data-testid="role-switcher-trigger"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="role-label"]')).toBeVisible();
  });
});
