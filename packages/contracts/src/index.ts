export type ApiEnvelope<T> = { data: T; meta?: { requestId?: string } };
