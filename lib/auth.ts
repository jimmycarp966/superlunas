import { jwtVerify, SignJWT } from "jose";

interface SessionPayload {
  role: "vendor" | "admin";
  [key: string]: any;
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
    return verified.payload as SessionPayload;
  } catch (err) {
    throw new Error("El token es invalido o expiro.");
  }
};

export const createToken = async (payload: SessionPayload) => {
  const secret = new TextEncoder().encode(getJwtSecretKey());
  const alg = "HS256";

  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("2h") // expiracion a 2hrs
    .sign(secret);
};
