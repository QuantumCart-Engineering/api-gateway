import {
    classifyUpstreamError,
    isUpstreamError
} from "../../../utils/upstream-error";
import { AppError } from "../../../utils/app-error";

describe("utils/upstream-error", () => {
    it("maps connection refusals to 503", () => {
        const info = classifyUpstreamError({
            code: "ECONNREFUSED"
        });

        expect(info.statusCode).toBe(503);
        expect(info.retryable).toBe(true);
    });

    it("maps timeouts to 504", () => {
        expect(
            classifyUpstreamError({ code: "ETIMEDOUT" })
                .statusCode
        ).toBe(504);
    });

    it("maps resets to 502", () => {
        expect(
            classifyUpstreamError({ code: "ECONNRESET" })
                .statusCode
        ).toBe(502);
    });

    it("falls back to 502 for unknown errors", () => {
        expect(
            classifyUpstreamError(new Error("boom")).statusCode
        ).toBe(502);
    });

    it("classifies socket hang up messages", () => {
        const info = classifyUpstreamError(
            new Error("socket hang up")
        );

        expect(info.statusCode).toBe(503);
    });

    it("classifies timeout messages", () => {
        const info = classifyUpstreamError(
            new Error("Upstream request timeout")
        );

        expect(info.statusCode).toBe(504);
    });

    it("does not treat AppError as an upstream error", () => {
        expect(isUpstreamError(new AppError("nope", 401))).toBe(
            false
        );
    });

    it("detects upstream errors", () => {
        expect(
            isUpstreamError({ code: "ECONNREFUSED" })
        ).toBe(true);
        expect(isUpstreamError(new Error("socket hang up"))).toBe(
            true
        );
        expect(isUpstreamError(new Error("random"))).toBe(false);
    });
});
