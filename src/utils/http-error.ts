/**
 * Shared error envelope used by every gateway error path so the shape is
 * identical whether an error is produced by the gateway itself or by the
 * proxy layer.
 */
export interface ErrorBody {
    success: false;
    error: {
        message: string;
        requestId?: string;
    };
}

export const buildErrorBody = (
    message: string,
    requestId?: string
): ErrorBody => ({
    success: false,
    error: {
        message,
        requestId
    }
});

/**
 * A response-like object. During a WebSocket upgrade the proxy reports the
 * error against a socket instead of a response, so callers must tolerate
 * both shapes.
 */
export interface WritableResponseLike {
    headersSent?: boolean;
    // Loosely typed so both `http.ServerResponse`/Express `Response` and
    // `net.Socket` (WebSocket upgrade) are assignable.
    writeHead?: (...args: any[]) => any;
    end?: (...args: any[]) => any;
}

export const sendErrorEnvelope = (
    res: WritableResponseLike | undefined,
    statusCode: number,
    message: string,
    requestId?: string
): boolean => {
    if (
        !res ||
        typeof res.writeHead !== "function" ||
        typeof res.end !== "function"
    ) {
        // Socket or already-destroyed response: nothing we can send.
        return false;
    }

    if (res.headersSent) {
        res.end();
        return false;
    }

    const body = JSON.stringify(buildErrorBody(message, requestId));

    res.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body).toString()
    });
    res.end(body);

    return true;
};
