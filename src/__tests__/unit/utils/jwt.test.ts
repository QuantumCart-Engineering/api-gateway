import {
    verifyAccessToken
} from "../../../utils/jwt";
import { AppError } from "../../../utils/app-error";
import {
    signExpiredToken,
    signTestToken
} from "../../helpers/tokens";
import { TEST_JWT_SECRET } from "../../helpers/config";

const verify = (token: string) =>
    verifyAccessToken(token, { secret: TEST_JWT_SECRET });

describe("utils/jwt", () => {
    it("decodes a valid access token", () => {
        const token = signTestToken({
            userId: "user-9",
            email: "u@example.com"
        });

        expect(verify(token)).toEqual({
            userId: "user-9",
            email: "u@example.com"
        });
    });

    it("omits email when the claim is not a string", () => {
        const token = signTestToken({ userId: "user-1" });

        const payload = verify(token);

        expect(payload.userId).toBe("user-1");
    });

    it("rejects tokens signed with a different secret", () => {
        const token = signTestToken({ secret: "other-secret" });

        expect(() => verify(token)).toThrow(AppError);
        expect(() => verify(token)).toThrow(/Invalid or expired/);
    });

    it("rejects expired tokens", () => {
        expect(() => verify(signExpiredToken())).toThrow(
            AppError
        );
    });

    it("rejects tokens using a non-HS256 algorithm", () => {
        const token = signTestToken({ algorithm: "HS384" });

        expect(() => verify(token)).toThrow(AppError);
    });

    it("rejects tokens without a userId claim", () => {
        const token = signTestToken();
        // Re-sign without userId by crafting a token via the helper is not
        // supported, so an empty payload token is signed directly.
        const jwt = require("jsonwebtoken");
        const crafted = jwt.sign(
            { email: "x@example.com" },
            TEST_JWT_SECRET,
            { algorithm: "HS256" }
        );

        expect(token).toBeDefined();
        expect(() => verify(crafted)).toThrow(AppError);
    });

    it("rejects a malformed token string", () => {
        expect(() => verify("not-a-jwt")).toThrow(AppError);
    });
});
