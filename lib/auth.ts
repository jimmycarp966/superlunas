import { jwtVerify, SignJWT } from "jose";
import { AppRole, SessionPayload } from "./roles";

export interface LegacySessionPayload {
    role: "vendor" | "admin";
}

export const getJwtSecretKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length === 0) {
        throw new Error("La variable de entorno JWT_SECRET no esta definida.");
    }
    return secret;
};

export const verifyAuth = async (token: string) => {
    try {
        const verified = await jwtVerify(
            token,
            new TextEncoder().encode(getJwtSecretKey())
        );
        const payload = verified.payload as unknown as SessionPayload | LegacySessionPayload;

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

        return payload as SessionPayload;
    } catch {
        throw new Error("El token es invalido o expiro.");
    }
};

export const createToken = async (payload: SessionPayload) => {
    const secret = new TextEncoder().encode(getJwtSecretKey());
    const alg = "HS256";

    return new SignJWT(payload as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secret);
};
