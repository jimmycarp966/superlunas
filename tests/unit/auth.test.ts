import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createToken, verifyAuth } from "../../lib/auth";
import { getCurrentDeploymentVersion } from "../../lib/deployment";
import type { SessionPayload } from "../../lib/roles";

vi.mock("../../lib/deployment", () => ({
    getCurrentDeploymentVersion: vi.fn(),
}));

const mockedGetCurrentDeploymentVersion = vi.mocked(getCurrentDeploymentVersion);
const originalJwtSecret = process.env.JWT_SECRET;

describe("auth deployment binding", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "test-secret-for-vitest";
        mockedGetCurrentDeploymentVersion.mockReset();
    });

    afterAll(() => {
        if (originalJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalJwtSecret;
        }
    });

    it("acepta sesiones del deployment actual", async () => {
        mockedGetCurrentDeploymentVersion.mockResolvedValue("build-a");

        const token = await createToken({ role: "vendor" } as unknown as SessionPayload);
        const session = await verifyAuth(token);

        expect(session).toEqual(expect.objectContaining({
            role: "vendedor",
            username: "vendor",
            nombre: "Vendedor",
        }));
    });

    it("rechaza sesiones firmadas en un deployment anterior", async () => {
        mockedGetCurrentDeploymentVersion
            .mockResolvedValueOnce("build-a")
            .mockResolvedValueOnce("build-b");

        const token = await createToken({ role: "vendor" } as unknown as SessionPayload);

        await expect(verifyAuth(token)).rejects.toThrow("invalido");
    });
});
