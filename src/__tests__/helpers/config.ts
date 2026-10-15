import { buildServiceTargets } from "../../config/services";

import type {
    GatewayConfig,
    RateLimitConfig,
    ServiceName
} from "../../types/gateway";

export const TEST_JWT_SECRET = "test-gateway-secret";

export const TEST_SERVICE_PORTS: Record<ServiceName, number> = {
    identity: 18001,
    product: 18002,
    cart: 18003,
    order: 18004,
    inventory: 18005,
    payment: 18006,
    customer: 18007
};

export const testServiceUrls = (
    ports: Partial<Record<ServiceName, number>> = {}
): Record<ServiceName, string> => {
    const merged = { ...TEST_SERVICE_PORTS, ...ports };

    return Object.fromEntries(
        Object.entries(merged).map(([name, port]) => [
            name,
            `http://127.0.0.1:${port}`
        ])
    ) as Record<ServiceName, string>;
};

export interface TestConfigOverrides {
    serviceUrls?: Partial<Record<ServiceName, string>>;
    port?: number;
    nodeEnv?: string;
    corsOrigins?: string[];
    rateLimitEnabled?: boolean;
    rateLimit?: Partial<RateLimitConfig>;
    swaggerEnabled?: boolean;
    proxyTimeoutMs?: number;
}

export const createTestConfig = (
    overrides: TestConfigOverrides = {}
): GatewayConfig => {
    const urls = {
        ...testServiceUrls(),
        ...(overrides.serviceUrls ?? {})
    };

    return {
        nodeEnv: overrides.nodeEnv ?? "test",
        port: overrides.port ?? 8000,
        services: buildServiceTargets(urls),
        jwt: {
            secret: TEST_JWT_SECRET,
            algorithm: "HS256"
        },
        proxyTimeoutMs: overrides.proxyTimeoutMs ?? 2000,
        bodyLimit: "1mb",
        corsOrigins: overrides.corsOrigins ?? [],
        rateLimit: {
            enabled: overrides.rateLimitEnabled ?? false,
            windowMs: 60_000,
            max: 100,
            authMax: 20,
            ...(overrides.rateLimit ?? {})
        },
        swaggerEnabled: overrides.swaggerEnabled ?? true
    };
};
