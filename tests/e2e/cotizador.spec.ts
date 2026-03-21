import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const localEnvPath = resolve(process.cwd(), ".env.local");

const parseEnvFile = (filePath: string): Record<string, string> => {
    if (!existsSync(filePath)) {
        return {};
    }

    return readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .reduce<Record<string, string>>((acc, line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                return acc;
            }

            const equalsIndex = trimmed.indexOf("=");
            if (equalsIndex === -1) {
                return acc;
            }

            const key = trimmed.slice(0, equalsIndex).trim();
            if (!key) {
                return acc;
            }

            const rawValue = trimmed.slice(equalsIndex + 1).trim();
            const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
            acc[key] = value;
            return acc;
        }, {});
};

const localEnv = parseEnvFile(localEnvPath);

const getRequiredValue = (name: "VENDOR_PASSWORD" | "ADMIN_PASSWORD"): string => {
    const value = process.env[name] ?? localEnv[name];
    if (!value) {
        throw new Error(`Falta ${name} en el entorno o en .env.local`);
    }

    return value;
};

const vendorPassword = getRequiredValue("VENDOR_PASSWORD");
const adminPassword = getRequiredValue("ADMIN_PASSWORD");

const loginAndExpectRoute = async (page: Page, loginUrl: string, password: string, expectedUrl: string) => {
    await page.goto(loginUrl);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(expectedUrl);
};

test.describe("Flujo Vendor - Cotizador", () => {
    test("Login exitoso y visualizacion de cotizador", async ({ page }) => {
        await loginAndExpectRoute(page, "http://localhost:3000", vendorPassword, "http://localhost:3000/cotizador");

        await expect(page.getByText("Cotizador")).toBeVisible();
        await expect(page.locator("button", { hasText: "Carrito" })).toBeVisible();
        await expect(page.locator("button", { hasText: "Manual" })).toBeVisible();
    });

    test("Login exitoso de administrador", async ({ page }) => {
        await loginAndExpectRoute(page, "http://localhost:3000/config", adminPassword, "http://localhost:3000/config/panel");

        await expect(page.getByRole("heading", { name: "Panel Admin" })).toBeVisible();
    });

    test("Validar Admin panel bloqueado para vendor", async ({ page }) => {
        await loginAndExpectRoute(page, "http://localhost:3000", vendorPassword, "http://localhost:3000/cotizador");

        await page.goto("http://localhost:3000/config/panel");

        await expect(page).toHaveURL("http://localhost:3000/");
    });

    // Nota: La simulacion E2E del archivo fuente requeriria tener la app corriendo en npm run dev
    // El E2E de Playwright comprobara el renderizado de la calculadora en base al listado
});
