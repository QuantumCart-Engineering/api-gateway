import { requestIdMiddleware } from "../../../middlewares/request-id.middleware";

import type { Request, Response } from "express";

const makeRes = () => ({ setHeader: jest.fn() }) as unknown as Response;

describe("middlewares/request-id", () => {
    it("generates a request id when none is supplied", () => {
        const req = { headers: {} } as unknown as Request;
        const res = makeRes();
        const next = jest.fn();

        requestIdMiddleware(req, res, next);

        expect(req.id).toBeDefined();
        expect(req.headers["x-request-id"]).toBe(req.id);
        expect(res.setHeader).toHaveBeenCalledWith(
            "x-request-id",
            req.id
        );
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("preserves a caller supplied request id", () => {
        const req = {
            headers: { "x-request-id": "trace-123" }
        } as unknown as Request;

        requestIdMiddleware(req, makeRes(), jest.fn());

        expect(req.id).toBe("trace-123");
    });

    it("ignores a blank caller supplied request id", () => {
        const req = {
            headers: { "x-request-id": "   " }
        } as unknown as Request;

        requestIdMiddleware(req, makeRes(), jest.fn());

        expect(req.id).toBeDefined();
        expect(req.id).not.toBe("   ");
    });
});
