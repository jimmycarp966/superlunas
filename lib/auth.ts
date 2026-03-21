import { jwtVerify, SignJWT } from "jose";
import { AppRole, isAppRole, SessionPayload } from "./roles";
import { getCurrentDeploymentVersion } from "./deployment";

export interface LegacySessionPayload {
    role: "vendor" | "admin";
}

interface SessionTokenPayload extends SessionPayload {
    deploymentVersion: string;
}

const toSessionPayload = (payload: SessionTokenPayload): SessionPayload => ({
    role: payload.role,
    userId: payload.userId,
    username: payload.username,
    nombre: payload.nombre,
    sucursalId: payload.sucursalId,
    zona: payload.zona,
});

export const getJwtSecretKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length === 0) {
        throw new Error("La variable de entorno JWT_SECRET no esta definida.");
    }
    return secret;
};

export const verifyAuth = async (token: string) => {
    try {
        const currentDeploymentVersion = await getCurrentDeploymentVersion();
        const verified = await jwtVerify(
            token,
            new TextEncoder().encode(getJwtSecretKey())
        );
        const payload = verified.payload as unknown as Partial<SessionTokenPayload> | LegacySessionPayload;

        const deploymentVersion = String((payload as Partial<SessionTokenPayload>).deploymentVersion ?? "").trim();
        if (!deploymentVersion || deploymentVersion !== currentDeploymentVersion) {
            throw new Error("La sesion pertenece a una version anterior.");
        }

        // Compatibilidad hacia atras: token viejo vendor/admin.
        if (payload.role === "vendor") {
            return {
                role: "vendedor" as AppRole,
                username: "vendor",
                nombre: "Vendedor",
            };
        }
        if (payload.role === "admin") {
            return {
                role: "admin" as AppRole,
                username: "admin",
                nombre: "Admin",
            };
        }

        if (!isAppRole((payload as Partial<SessionTokenPayload>).role ?? "")) {
            throw new Error("El token es invalido o expiro.");
        }

        return toSessionPayload(payload as SessionTokenPayload);
    } catch {
        throw new Error("El token es invalido o expiro.");
    }
};

export const createToken = async (payload: SessionPayload) => {
    const deploymentVersion = await getCurrentDeploymentVersion();
    const secret = new TextEncoder().encode(getJwtSecretKey());
    const alg = "HS256";

    return new SignJWT({ ...payload, deploymentVersion } as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secret);
};
