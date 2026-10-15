jest.mock("http-proxy-middleware", () => ({
    createProxyMiddleware: jest.fn(
        () => (_req: unknown, _res: unknown, next: () => void) =>
            next()
    ),
    fixRequestBody: jest.fn()
}));

import request from "supertest";

import { createApp } from "../../../app";
import { createTestConfig } from "../../helpers/config";

describe("middlewares/rate-limit", () => {
    it("limits global requests when enabled", async () => {
        const app = createApp(
            createTestConfig({
                rateLimitEnabled: true,
                rateLimit: { max: 1, authMax: 100 }
            })
        );

        const first = await request(app).get("/health");
        const second = await request(app).get("/health");

        expect(first.status).toBe(200);
        expect(second.status).toBe(429);
        expect(second.body).toMatchObject({
            success: false,
            error: {
                message: expect.stringMatching(/too many/i)
            }
        });
    });

    it("applies a stricter limit to credential endpoints", async () => {
        const app = createApp(
            createTestConfig({
                rateLimitEnabled: true,
                rateLimit: { max: 100, authMax: 1 }
            })
        );

        const first = await request(app).post(
            "/api/v1/auth/login"
        );
        const second = await request(app).post(
            "/api/v1/auth/login"
        );

        // The first request passes the limiter and reaches the (mocked)
        // proxy; the second is rejected by the stricter auth limiter.
        expect(first.status).not.toBe(429);
        expect(second.status).toBe(429);
    });

    it("does not limit when disabled", async () => {
        const app = createApp(
            createTestConfig({
                rateLimitEnabled: false,
                rateLimit: { max: 1, authMax: 1 }
            })
        );

        expect((await request(app).get("/health")).status).toBe(200);
        expect((await request(app).get("/health")).status).toBe(200);
    });
});
