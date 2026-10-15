import jwt from "jsonwebtoken";

import { AppError } from "../utils/app-error";

/**
 * Access token payload issued by the identity-service.
 *
 * The identity-service signs tokens with jsonwebtoken's default algorithm
 * (HS256) and a payload of `{ userId, email }`, plus the standard `iat`
 * and `exp` claims.
 */
export interface AccessTokenPayload {
    userId: string;
    email?: string;
}

export interface JwtVerificationOptions {
    secret: string;
    algorithm?: jwt.Algorithm;
}

export const verifyAccessToken = (
    token: string,
    options: JwtVerificationOptions
): AccessTokenPayload => {
    let decoded: string | jwt.JwtPayload;

    try {
        decoded = jwt.verify(token, options.secret, {
            algorithms: [options.algorithm ?? "HS256"]
        });
    } catch {
        throw new AppError("Invalid or expired token", 401);
    }

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        typeof (decoded as jwt.JwtPayload).userId !== "string"
    ) {
        throw new AppError("Invalid or expired token", 401);
    }

    const payload = decoded as jwt.JwtPayload;

    return {
        userId: payload.userId as string,
        ...(typeof payload.email === "string"
            ? { email: payload.email }
            : {})
    };
};
