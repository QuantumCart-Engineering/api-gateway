import {
    getRequestId,
    pickRequestId
} from "../../../utils/request-id";

describe("utils/request-id", () => {
    it("returns a trimmed header value", () => {
        expect(
            getRequestId({ "x-request-id": "  abc  " })
        ).toBe("abc");
    });

    it("returns undefined for missing or blank headers", () => {
        expect(getRequestId({})).toBeUndefined();
        expect(getRequestId({ "x-request-id": "   " })).toBeUndefined();
        expect(getRequestId({ "x-request-id": 42 })).toBeUndefined();
    });

    it("prefers the request id set on the request", () => {
        expect(
            pickRequestId(
                { id: "req-id", headers: {} },
                { getHeader: jest.fn() }
            )
        ).toBe("req-id");
    });

    it("falls back to the response header", () => {
        expect(
            pickRequestId(
                { headers: {} },
                { getHeader: jest.fn().mockReturnValue("res-id") }
            )
        ).toBe("res-id");
    });
});
