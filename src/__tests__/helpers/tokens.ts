import jwt from "jsonwebtoken";

import { TEST_JWT_SECRET } from "./config";

export interface TestTokenOptions {
    userId?: string;
    email?: string;
    secret?: string;
    expiresIn?: jwt.SignOptions["expiresIn"];
    algorithm?: jwt.Algorithm;
}

export const signTestToken = (
    options: TestTokenOptions = {}
): string => {
    const payload = {
        userId: options.userId ?? "user-123",
        email: options.email ?? "user@example.com"
    };

    return jwt.sign(payload, options.secret ?? TEST_JWT_SECRET, {
        algorithm: options.algorithm ?? "HS256",
        expiresIn: options.expiresIn ?? "15m"
    });
};

export const signExpiredToken = (): string =>
    signTestToken({ expiresIn: -10 });
