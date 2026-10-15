import http from "node:http";
import type { AddressInfo } from "node:net";

import request from "supertest";

import { createApp } from "../../app";
import {
    createTestConfig
} from "../helpers/config";
import { signTestToken } from "../helpers/tokens";

interface CapturedRequest {
    method?: string;
    url?: string;
    headers: http.IncomingHttpHeaders;
    body: string;
}

const startUpstream = (): Promise<{
    server: http.Server;
    port: number;
    requests: CapturedRequest[];
}> => {
    const requests: CapturedRequest[] = [];

    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: Buffer.concat(chunks).toString("utf8")
            });

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(
                JSON.stringify({
                    ok: true,
                    service: "upstream",
                    method: req.method,
                    url: req.url
                })
            );
        });
    });

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, port, requests });
        });
    });
};

const lastRequest = (captured: CapturedRequest[]): CapturedRequest =>
    captured[captured.length - 1];

const allocateClosedPort = async (): Promise<number> => {
    const { server, port } = await startUpstream();

    server.closeAllConnections();
    await new Promise<void>((resolve) =>
        server.close(() => resolve())
    );

    return port;
};

describe("gateway (integration)", () => {
    let upstream: Awaited<ReturnType<typeof startUpstream>>;

    beforeAll(async () => {
        upstream = await startUpstream();
    });

    afterAll(async () => {
        upstream.server.closeAllConnections();
        await new Promise<void>((resolve) =>
            upstream.server.close(() => resolve())
        );
    });

    const configFor = () =>
        createTestConfig({
            serviceUrls: {
                identity: `http://127.0.0.1:${upstream.port}`,
                product: `http://127.0.0.1:${upstream.port}`,
                cart: `http://127.0.0.1:${upstream.port}`,
                order: `http://127.0.0.1:${upstream.port}`,
                inventory: `http://127.0.0.1:${upstream.port}`,
                payment: `http://127.0.0.1:${upstream.port}`,
                customer: `http://127.0.0.1:${upstream.port}`
            }
        });

    it("proxies a public request and preserves method, path and body", async () => {
        const app = createApp(configFor());

        const payload = {
            email: "user@example.com",
            password: "s3cret"
        };

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            ok: true,
            method: "POST",
            url: "/api/v1/auth/login"
        });

        expect(lastRequest(upstream.requests).body).toBe(
            JSON.stringify(payload)
        );
    });

    it("preserves the query string on a proxied public GET", async () => {
        const app = createApp(configFor());

        const response = await request(app).get(
            "/api/v1/products?limit=5&sort=price"
        );

        expect(response.status).toBe(200);
        expect(lastRequest(upstream.requests).url).toBe(
            "/api/v1/products?limit=5&sort=price"
        );
    });

    it("does not reach the upstream when a protected route is unauthenticated", async () => {
        const app = createApp(configFor());

        const before = upstream.requests.length;

        const response = await request(app).get("/api/v1/cart");

        expect(response.status).toBe(401);
        expect(upstream.requests.length).toBe(before);
    });

    it("injects the verified x-user-id downstream", async () => {
        const app = createApp(configFor());

        const token = signTestToken({ userId: "user-abc" });

        const response = await request(app)
            .get("/api/v1/cart")
            .set("authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);

        const captured = lastRequest(upstream.requests);

        expect(captured.headers["x-user-id"]).toBe("user-abc");
        expect(captured.headers["x-request-id"]).toBeDefined();
    });

    it("strips a client supplied x-user-id header", async () => {
        const app = createApp(configFor());

        const token = signTestToken({ userId: "trusted-user" });

        await request(app)
            .get("/api/v1/orders")
            .set("authorization", `Bearer ${token}`)
            .set("x-user-id", "attacker-user");

        expect(
            lastRequest(upstream.requests).headers["x-user-id"]
        ).toBe("trusted-user");
    });

    it("forwards a caller supplied request id downstream", async () => {
        const app = createApp(configFor());

        const token = signTestToken();

        await request(app)
            .get("/api/v1/payments")
            .set("authorization", `Bearer ${token}`)
            .set("x-request-id", "trace-xyz");

        expect(
            lastRequest(upstream.requests).headers["x-request-id"]
        ).toBe("trace-xyz");
    });

    it("returns 404 for a path owned by no service", async () => {
        const app = createApp(configFor());

        const response = await request(app).get(
            "/api/v1/nonexistent"
        );

        expect(response.status).toBe(404);
    });

    it("reports ready when all dependencies respond", async () => {
        const app = createApp(configFor());

        const response = await request(app).get("/ready");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ready");
        expect(response.body.dependencies).toHaveLength(7);
        expect(
            response.body.dependencies.every(
                (dependency: { status: string }) =>
                    dependency.status === "up"
            )
        ).toBe(true);
    });

    it("reports not ready when a dependency is unreachable", async () => {
        const port = await allocateClosedPort();

        const app = createApp(
            createTestConfig({
                serviceUrls: {
                    identity: `http://127.0.0.1:${port}`,
                    product: `http://127.0.0.1:${port}`,
                    cart: `http://127.0.0.1:${port}`,
                    order: `http://127.0.0.1:${port}`,
                    inventory: `http://127.0.0.1:${port}`,
                    payment: `http://127.0.0.1:${port}`,
                    customer: `http://127.0.0.1:${port}`
                }
            })
        );

        const response = await request(app).get("/ready");

        expect(response.status).toBe(503);
        expect(response.body.status).toBe("not_ready");
    });

    it("returns 503 when the upstream service is unreachable", async () => {
        const port = await allocateClosedPort();

        const app = createApp(
            createTestConfig({
                serviceUrls: {
                    identity: `http://127.0.0.1:${port}`,
                    product: `http://127.0.0.1:${port}`,
                    cart: `http://127.0.0.1:${port}`,
                    order: `http://127.0.0.1:${port}`,
                    inventory: `http://127.0.0.1:${port}`,
                    payment: `http://127.0.0.1:${port}`,
                    customer: `http://127.0.0.1:${port}`
                }
            })
        );

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: "a@b.com", password: "x" });

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toMatch(
            /unavailable/i
        );
    });
});
