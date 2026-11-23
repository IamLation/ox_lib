interface RateLimit {
  perSecond: number;
  burst: number;
}

interface EventBucket {
  tokens: number;
  updatedAt: number;
}

function createEventRateLimiter({ perSecond, burst }: RateLimit) {
  const buckets = new Map<number, EventBucket>();

  on("playerDropped", () => buckets.delete(+source));

  return (playerId: number): boolean => {
    const now = Date.now();
    const bucket = buckets.get(playerId) ?? { tokens: burst, updatedAt: now };
    const updatedAt = Math.max(now, bucket.updatedAt);
    const elapsedSeconds = (updatedAt - bucket.updatedAt) / 1000;

    bucket.tokens = Math.min(burst, bucket.tokens + elapsedSeconds * perSecond);
    bucket.updatedAt = updatedAt;
    buckets.set(playerId, bucket);

    if (bucket.tokens < 1) return false;

    bucket.tokens -= 1;

    return true;
  };
}

export function onGameEvent<Payload = unknown>(
  eventName: string,
  limit: RateLimit,
  handler?: (sender: number, payload: Payload) => void,
) {
  const allow = createEventRateLimiter(limit);

  on(eventName, (sender: string | number, payload: Payload) => {
    const playerId = +sender;

    if (!allow(playerId)) return CancelEvent();

    handler?.(playerId, payload);
  });
}
