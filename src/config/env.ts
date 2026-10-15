import dotenv from "dotenv";

import {
    SERVICE_NAMES,
    SERVICE_URL_ENV,
    buildServiceTargets
} from "./services";

import type {
    GatewayConfig,
    ServiceName
} from "../types/gateway";

type Env = NodeJS.ProcessEnv;

const loadEnvFiles = (): void => {
    if (process.env.NODE_ENV === "test") {
        dotenv.config({ path: ".env.test", quiet: true });
        return;
    }

    dotenv.config({ quiet: true });
};

const requiredEnv = (env: Env, name: string): string => {
    const value = env[name];

    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(
            `Missing required environment variable: ${name}`
        );
    }

    return value.trim();
};

const optionalEnv = (
    env: Env,
    name: string,
    fallback: string
): string => {
    const value = env[name];

    if (typeof value !== "string" || value.trim() === "") {
        return fallback;
    }

    return value.trim();
};

const positiveIntegerEnv = (
    env: Env,
    name: string,
    fallback: number
): number => {
    const raw = env[name];

    if (typeof raw !== "string" || raw.trim() === "") {
        return fallback;
    }

    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive integer`
        );
    }

    return parsed;
};

const booleanEnv = (
    env: Env,
    name: string,
    fallback: boolean
): boolean => {
    const raw = env[name];

    if (typeof raw !== "string" || raw.trim() === "") {
        return fallback;
    }

    return ["1", "true", "yes", "on"].includes(
        raw.trim().toLowerCase()
    );
};

const csvEnv = (env: Env, name: string): string[] => {
    const raw = env[name];

    if (typeof raw !== "string" || raw.trim() === "") {
        return [];
    }

    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
};

export const loadGatewayConfig = (
    env: Env = process.env
): GatewayConfig => {
    const algorithm = optionalEnv(
        env,
        "JWT_ALGORITHM",
        "HS256"
    );

    if (algorithm !== "HS256") {
        throw new Error(
            `Unsupported JWT_ALGORITHM "${algorithm}". Only HS256 is supported.`
        );
    }

    const serviceUrls = {} as Record<ServiceName, string>;

    for (const name of SERVICE_NAMES) {
        serviceUrls[name] = requiredEnv(
            env,
            SERVICE_URL_ENV[name]
        );
    }

    return {
        nodeEnv: optionalEnv(env, "NODE_ENV", "development"),
        port: positiveIntegerEnv(env, "PORT", 8000),

        services: buildServiceTargets(serviceUrls),

        jwt: {
            secret: requiredEnv(env, "JWT_SECRET"),
            algorithm: "HS256"
        },

        proxyTimeoutMs: positiveIntegerEnv(
            env,
            "PROXY_TIMEOUT_MS",
            30000
        ),
        bodyLimit: optionalEnv(env, "BODY_LIMIT", "1mb"),

        corsOrigins: csvEnv(env, "ALLOWED_ORIGINS"),

        rateLimit: {
            enabled: booleanEnv(env, "RATE_LIMIT_ENABLED", true),
            windowMs: positiveIntegerEnv(
                env,
                "RATE_LIMIT_WINDOW_MS",
                15 * 60 * 1000
            ),
            max: positiveIntegerEnv(env, "RATE_LIMIT_MAX", 300),
            authMax: positiveIntegerEnv(
                env,
                "AUTH_RATE_LIMIT_MAX",
                50
            )
        },

        swaggerEnabled: booleanEnv(env, "SWAGGER_ENABLED", true)
    };
};

let cached: GatewayConfig | undefined;

export const getGatewayConfig = (): GatewayConfig => {
    if (!cached) {
        loadEnvFiles();
        cached = loadGatewayConfig();
    }

    return cached;
};

export const resetGatewayConfigCache = (): void => {
    cached = undefined;
};
