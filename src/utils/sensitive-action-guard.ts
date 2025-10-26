export interface SensitiveActionContext {
    method?: string;
    url?: string;
    description?: string;
}

type RequestHandler = (context?: SensitiveActionContext) => Promise<string | null>;

interface PendingRequest {
    context?: SensitiveActionContext;
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
}

let handler: RequestHandler | null = null;
const queue: PendingRequest[] = [];
let processing = false;

function processQueue() {
    if (processing || !handler) {
        return;
    }
    const next = queue.shift();
    if (!next) {
        return;
    }
    processing = true;
    handler(next.context)
        .then((token) => next.resolve(token ?? null))
        .catch((error) => next.reject(error))
        .finally(() => {
            processing = false;
            processQueue();
        });
}

export function registerSensitiveActionRequester(requestHandler: RequestHandler) {
    handler = requestHandler;
    processQueue();
}

export function unregisterSensitiveActionRequester(requestHandler: RequestHandler) {
    if (handler === requestHandler) {
        handler = null;
    }
}

export class SensitiveActionCancelledError extends Error {
    constructor(message = '敏感操作已取消') {
        super(message);
        this.name = 'SensitiveActionCancelledError';
    }
}

export function enqueueSensitiveActionCheck(context?: SensitiveActionContext) {
    return new Promise<string | null>((resolve, reject) => {
        queue.push({ context, resolve, reject });
        processQueue();
    });
}

export async function ensureSensitiveActionToken(context?: SensitiveActionContext): Promise<string> {
    const token = await enqueueSensitiveActionCheck(context);
    if (!token) {
        throw new SensitiveActionCancelledError();
    }
    return token;
}
