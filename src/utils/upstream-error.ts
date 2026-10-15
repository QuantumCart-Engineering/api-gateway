import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error";

export interface UpstreamErrorInfo {
    statusCode: number;
    message: string;
    retryable: boolean;
}

const TIMEOUT_CODES = new Set([
    "ETIMEDOUT",
    "ESOCKETTIMEDOUT",
    "ERR_HTTP_REQUEST_TIMEOUT"
]);

const UNAVAILABLE_CODES = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "ENETUNREACH"
]);

const RESET_CODES = new Set([
    "ECONNRESET",
    "EPIPE",
    "ERR_STREAM_PREMATURE_CLOSE"
]);

const codeOf = (error: unknown): string | undefined => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
    ) {
        return (error as { code: string }).code;
    }

    return undefined;
};

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

/**
 * Translate a low level upstream/proxy error into a stable HTTP status
 * and a client safe message. Internal details (hostnames, stack traces,
 * socket addresses) are never returned to the caller.
 */
export const classifyUpstreamError = (
    error: unknown
): UpstreamErrorInfo => {
    const code = codeOf(error);

    if (code && TIMEOUT_CODES.has(code)) {
        return {
            statusCode: 504,
            message: "Upstream service timed out",
            retryable: true
        };
    }

    if (code && UNAVAILABLE_CODES.has(code)) {
        return {
            statusCode: 503,
            message: "Upstream service is unavailable",
            retryable: true
        };
    }

    if (code && RESET_CODES.has(code)) {
        return {
            statusCode: 502,
            message: "Upstream service connection failed",
            retryable: true
        };
    }

    const message = messageOf(error).toLowerCase();

    if (message.includes("timeout") || message.includes("timed out")) {
        return {
            statusCode: 504,
            message: "Upstream service timed out",
            retryable: true
        };
    }

    if (
        message.includes("econnrefused") ||
        message.includes("enotfound") ||
        message.includes("socket hang up")
    ) {
        return {
            statusCode: 503,
            message: "Upstream service is unavailable",
            retryable: true
        };
    }

    return {
        statusCode: 502,
        message: "Upstream service request failed",
        retryable: false
    };
};

export const isUpstreamError = (error: unknown): boolean => {
    if (error instanceof AppError) {
        return false;
    }

    const code = codeOf(error);

    if (
        code &&
        (TIMEOUT_CODES.has(code) ||
            UNAVAILABLE_CODES.has(code) ||
            RESET_CODES.has(code))
    ) {
        return true;
    }

    const message = messageOf(error).toLowerCase();

    return (
        message.includes("proxy") ||
        message.includes("socket hang up") ||
        message.includes("econnrefused") ||
        message.includes("timeout") ||
        message.includes("timed out")
    );
};

export type UpstreamErrorHandler = (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => void;
