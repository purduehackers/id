import Redis from "ioredis";

let _kv: Redis | null = null;

function getKv() {
  if (!_kv) {
    const kvUrl = process.env.KV_URL;
    if (!kvUrl) {
      throw new Error("KV_URL environment variable is required");
    }
    _kv = new Redis(kvUrl);
  }
  return _kv;
}

export const kv = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    return Reflect.get(getKv(), prop, receiver);
  },
});

export type Kv = Redis;
