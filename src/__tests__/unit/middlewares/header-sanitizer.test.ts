import { stripHopByHopHeaders } from "../../../middlewares/header-sanitizer.middleware";

import type { Request, Response } from "express";

const makeReq = (headers: Record<string, unknown>) =>
    ({ headers } as unknown as Request);

describe("middlewares/header-sanitizer", () => {
    it("removes hop-by-hop headers", () => {
        const req = makeReq({
            connection: "keep-alive",
            "keep-alive": "timeout=5",
            te: "trailers",
            "transfer-encoding": "chunked",
            upgrade: "websocket",
            "content-type": "application/json"
        });

        const next = jest.fn();

        stripHopByHopHeaders(
            req,
            {} as Response,
            next
        );

        expect(req.headers.connection).toBeUndefined();
        expect(req.headers["keep-alive"]).toBeUndefined();
        expect(req.headers.te).toBeUndefined();
        expect(req.headers["transfer-encoding"]).toBeUndefined();
        expect(req.headers.upgrade).toBeUndefined();
        expect(req.headers["content-type"]).toBe(
            "application/json"
        );
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("removes headers named by a Connection directive", () => {
        const req = makeReq({
            connection: "keep-alive, x-custom",
            "x-custom": "secret"
        });

        stripHopByHopHeaders(req, {} as Response, jest.fn());

        expect(req.headers["x-custom"]).toBeUndefined();
    });
});
