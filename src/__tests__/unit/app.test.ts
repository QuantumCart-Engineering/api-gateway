jest.mock("http-proxy-middleware", () => ({
    createProxyMiddleware: jest.fn(
        () => (_req: unknown, _res: unknown, next: () => void) =>
            next()
    ),
    fixRequestBody: jest.fn()
}));

import request from "supertest";

import { createApp } from "../../app";
import {
    createTestConfig
} from "../helpers/config";
import {
    signExpiredToken,
    signTestToken
} from "../helpers/tokens";

describe("app (unit)", () => {
    const app = createApp(createTestConfig());

    describe("health", () => {
        it("returns 200 and gateway metadata", async () => {
            const response = await request(app).get("/health");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: "ok",
                service: "api-gateway"
            });
            expect(typeof response.body.uptime).toBe("number");
        });
    });

    describe("request id", () => {
        it("echoes a supplied correlation id", async () => {
            const response = await request(app)
                .get("/health")
                .set("x-request-id", "trace-42");

            expect(response.headers["x-request-id"]).toBe(
                "trace-42"
            );
        });

        it("generates a correlation id when absent", async () => {
            const response = await request(app).get("/health");

            expect(response.headers["x-request-id"]).toBeDefined();
        });
    });

    describe("authentication", () => {
        it("rejects a protected route without a token", async () => {
            const response = await request(app).get(
                "/api/v1/cart"
            );

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toMatch(
                /token/i
            );
        });

        it("rejects an invalid authorization scheme", async () => {
            const response = await request(app)
                .get("/api/v1/cart")
                .set("authorization", `Basic ${signTestToken()}`);

            expect(response.status).toBe(401);
        });

        it("rejects an expired token", async () => {
            const response = await request(app)
                .get("/api/v1/orders")
                .set(
                    "authorization",
                    `Bearer ${signExpiredToken()}`
                );

            expect(response.status).toBe(401);
        });

        it("rejects a token signed with the wrong secret", async () => {
            const response = await request(app)
                .get("/api/v1/cart")
                .set(
                    "authorization",
                    `Bearer ${signTestToken({
                        secret: "nope"
                    })}`
                );

            expect(response.status).toBe(401);
        });

        it("does not require a token for public routes", async () => {
            const response = await request(app).post(
                "/api/v1/auth/login"
            );

            // Reaches the (mocked) proxy and then falls through to 404.
            expect(response.status).not.toBe(401);
        });
    });

    describe("routing", () => {
        it("returns a JSON 404 envelope for unknown routes", async () => {
            const response = await request(app).get(
                "/totally-unknown"
            );

            expect(response.status).toBe(404);
            expect(response.body).toMatchObject({
                success: false,
                error: {
                    message: expect.stringContaining(
                        "not found"
                    )
                }
            });
        });
    });

    describe("docs", () => {
        it("serves the OpenAPI document", async () => {
            const response = await request(app).get(
                "/openapi.json"
            );

            expect(response.status).toBe(200);
            expect(response.body.openapi).toBe("3.0.3");
            expect(response.body.info.title).toMatch(
                /QuantumCart API Gateway/
            );
        });

        it("can be disabled", async () => {
            const docsDisabled = createApp(
                createTestConfig({ swaggerEnabled: false })
            );

            const response = await request(docsDisabled).get(
                "/openapi.json"
            );

            expect(response.status).toBe(404);
        });
    });

    describe("cors", () => {
        it("exposes the request id header", async () => {
            const response = await request(app)
                .get("/health")
                .set("origin", "https://shop.example");

            expect(
                response.headers["access-control-expose-headers"]
            ).toMatch(/x-request-id/i);
        });
    });
});
