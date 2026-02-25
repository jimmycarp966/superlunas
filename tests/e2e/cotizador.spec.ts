import { test, expect } from '@playwright/test';

test.describe('Flujo Vendor - Cotizador', () => {
    test('Login exitoso y visualización de cotizador', async ({ page }) => {
        // Ir a la raiz
        await page.goto('http://localhost:3000');

        // Login Vendor
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        // Debe llevarnos a cotizador
        await expect(page).toHaveURL('http://localhost:3000/cotizador');

        // Verificamos que cargan los tabs
        await expect(page.locator('button', { hasText: '1 Artículo' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Carrito' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Manual' })).toBeVisible();
    });

    test('Validar Admin panel bloqueado para vendor', async ({ page }) => {
        // Acceso vendor
        await page.goto('http://localhost:3000');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        await page.waitForURL('http://localhost:3000/cotizador');

        // Intentar ir a admin panel (sin permisos admin)
        await page.goto('http://localhost:3000/config/panel');

        // Deberia redirigir o restringir el acceso
        await expect(page).toHaveURL('http://localhost:3000/');
    });

    // Nota: La simulacion E2E del archivo fuente requeriria tener la app corriendo en npm run dev
    // El E2E de Playwright comprobara el renderizado de la calculadora en base al listado
});
