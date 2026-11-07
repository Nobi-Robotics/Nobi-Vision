type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();

const CAPACITY = 8;
const REFILL_PER_MS = 12 / 60_000;

export function takeToken(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updated: now };
  const refilled = Math.min(CAPACITY, bucket.tokens + (now - bucket.updated) * REFILL_PER_MS);
  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, updated: now });
    return false;
  }
  buckets.set(key, { tokens: refilled - 1, updated: now });
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return "local";
}
