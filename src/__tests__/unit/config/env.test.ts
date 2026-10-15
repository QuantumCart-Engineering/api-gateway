import {
    getGatewayConfig,
    loadGatewayConfig,
    resetGatewayConfigCache
} from "../../../config/env";

const baseEnv = (): NodeJS.ProcessEnv => ({
    NODE_ENV: "test",
    PORT: "8000",
    JWT_SECRET: "secret",
    IDENTITY_SERVICE_URL: "http://identity:8001",
    PRODUCT_SERVICE_URL: "http://product:8002",
    CART_SERVICE_URL: "http://cart:8003",
    ORDER_SERVICE_URL: "http://order:8004",
    INVENTORY_SERVICE_URL: "http://inventory:8005",
    PAYMENT_SERVICE_URL: "http://payment:8006",
    CUSTOMER_SERVICE_URL: "http://customer:8007"
});

describe("config/env", () => {
    it("loads a valid configuration with defaults", () => {
        const config = loadGatewayConfig(baseEnv());

        expect(config.port).toBe(8000);
        expect(config.jwt.secret).toBe("secret");
        expect(config.jwt.algorithm).toBe("HS256");
        expect(config.proxyTimeoutMs).toBe(30000);
        expect(config.bodyLimit).toBe("1mb");
        expect(config.rateLimit.enabled).toBe(true);
        expect(config.swaggerEnabled).toBe(true);
        expect(config.services.cart.baseUrl).toBe(
            "http://cart:8003"
        );
        expect(config.services.cart.healthPath).toBe("/health");
    });

    it("throws when JWT_SECRET is missing", () => {
        const env = baseEnv();
        delete env.JWT_SECRET;

        expect(() => loadGatewayConfig(env)).toThrow(
            /JWT_SECRET/
        );
    });

    it("throws when a required service url is missing", () => {
        const env = baseEnv();
        delete env.ORDER_SERVICE_URL;

        expect(() => loadGatewayConfig(env)).toThrow(
            /ORDER_SERVICE_URL/
        );
    });

    it("rejects unsupported JWT algorithms", () => {
        const env = baseEnv();
        env.JWT_ALGORITHM = "none";

        expect(() => loadGatewayConfig(env)).toThrow(
            /HS256/
        );
    });

    it("parses numeric, boolean and list values", () => {
        const env = baseEnv();
        env.PORT = "9000";
        env.PROXY_TIMEOUT_MS = "1500";
        env.RATE_LIMIT_ENABLED = "false";
        env.SWAGGER_ENABLED = "0";
        env.ALLOWED_ORIGINS =
            "https://a.example, https://b.example";

        const config = loadGatewayConfig(env);

        expect(config.port).toBe(9000);
        expect(config.proxyTimeoutMs).toBe(1500);
        expect(config.rateLimit.enabled).toBe(false);
        expect(config.swaggerEnabled).toBe(false);
        expect(config.corsOrigins).toEqual([
            "https://a.example",
            "https://b.example"
        ]);
    });

    it("rejects invalid integer values", () => {
        const env = baseEnv();
        env.PORT = "abc";

        expect(() => loadGatewayConfig(env)).toThrow(
            /PORT/
        );
    });

    describe("getGatewayConfig", () => {
        const keys = Object.keys(baseEnv());

        afterEach(() => {
            resetGatewayConfigCache();
            for (const key of keys) {
                delete process.env[key];
            }
        });

        it("loads configuration from process.env once", () => {
            for (const [key, value] of Object.entries(baseEnv())) {
                process.env[key] = value;
            }

            const first = getGatewayConfig();
            const second = getGatewayConfig();

            expect(first).toBe(second);
            expect(first.services.identity.baseUrl).toBe(
                "http://identity:8001"
            );
        });
    });
});
