import { errorMiddleware } from "../../../middlewares/error.middleware";
import { AppError } from "../../../utils/app-error";

import type { NextFunction, Request, Response } from "express";

interface MockResponse extends Response {
    status: jest.Mock;
    json: jest.Mock;
}

const makeReq = (overrides: Partial<Request> = {}) =>
    ({
        id: "req-1",
        method: "GET",
        originalUrl: "/api/v1/cart",
        headers: {},
        ...overrides
    } as unknown as Request);

const makeRes = (
    overrides: Partial<MockResponse> = {}
): MockResponse => {
    const res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        getHeader: jest.fn(),
        setHeader: jest.fn(),
        ...overrides
    };

    return res as unknown as MockResponse;
};

describe("middlewares/error", () => {
    it("renders an AppError with its status and request id", () => {
        const res = makeRes();

        errorMiddleware(
            new AppError("Conflict", 409),
            makeReq(),
            res,
            jest.fn()
        );

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: "Conflict", requestId: "req-1" }
        });
    });

    it("renders a generic 500 for unexpected errors", () => {
        const res = makeRes();

        errorMiddleware(
            new Error("kaboom"),
            makeReq(),
            res,
            jest.fn()
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: {
                message: "Internal server error",
                requestId: "req-1"
            }
        });
    });

    it("translates an unreachable upstream to 503", () => {
        const res = makeRes();

        errorMiddleware(
            { code: "ECONNREFUSED" },
            makeReq(),
            res,
            jest.fn()
        );

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    message: expect.stringMatching(/unavailable/i)
                })
            })
        );
    });

    it("translates a timeout to 504", () => {
        const res = makeRes();

        errorMiddleware(
            { code: "ETIMEDOUT" },
            makeReq(),
            res,
            jest.fn()
        );

        expect(res.status).toHaveBeenCalledWith(504);
    });

    it("delegates when the response has already started", () => {
        const res = makeRes({ headersSent: true });
        const next = jest.fn();
        const error = new Error("late");

        errorMiddleware(error, makeReq(), res, next);

        expect(next).toHaveBeenCalledWith(error);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("falls back to a header request id when req.id is absent", () => {
        const res = makeRes({
            getHeader: jest.fn().mockReturnValue("header-id")
        });

        errorMiddleware(
            new AppError("Nope", 400),
            makeReq({ id: undefined }),
            res,
            jest.fn()
        );

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    requestId: "header-id"
                })
            })
        );
    });
});
