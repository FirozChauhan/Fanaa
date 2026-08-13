import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;

/**
 * In-process read cache.
 *
 * Every action (home, open page, save, search) makes several R2 round-trips,
 * and most of them re-read the same small objects over and over — the home
 * page alone fetched index.json and lock.json twice each, and getPage
 * re-read the whole index to look up one page. A round-trip to R2 costs
 * ~100–300ms, so those duplicate serial reads dominate perceived latency.
 *
 * Successful reads (including "NoSuchKey" → null) are cached; putObject and
 * deleteObject write through, so within this process a save/delete is always
 * immediately visible. A short TTL bounds staleness across multiple server
 * instances (worst case: one TTL behind), and a byte cap keeps memory flat.
 */
const CACHE_TTL_MS = 5_000;
const CACHE_MAX_BYTES = 8 * 1024 * 1024;

type CacheEntry = { at: number; body: Buffer | null };

/**
 * The cache lives on globalThis, not module scope: Turbopack (dev) can give
 * each route segment its own copy of this module, and separate copies would
 * each hold their own cache — the layout's lock.json read would not dedupe
 * against the page's. globalThis is shared across every copy in the process.
 */
type CacheState = { readCache: Map<string, CacheEntry>; bytes: number };
const g = globalThis as typeof globalThis & {
  __fanaaR2Cache?: CacheState;
};
const cacheState: CacheState = (g.__fanaaR2Cache ??= {
  readCache: new Map(),
  bytes: 0,
});
const { readCache } = cacheState;

/** Returns cached body, or undefined on a miss/expired entry. */
function cacheGet(key: string): Buffer | null | undefined {
  const hit = readCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    readCache.delete(key);
    if (hit.body) cacheState.bytes -= hit.body.length;
    return undefined;
  }
  return hit.body;
}

function cacheSet(key: string, body: Buffer | null): void {
  const prev = readCache.get(key);
  if (prev?.body) cacheState.bytes -= prev.body.length;
  if (body) cacheState.bytes += body.length;
  readCache.set(key, { at: Date.now(), body });
  // Evict the oldest entries (Map preserves insertion order) while over cap.
  while (cacheState.bytes > CACHE_MAX_BYTES && readCache.size > 1) {
    const oldestKey = readCache.keys().next().value as string;
    const entry = readCache.get(oldestKey);
    readCache.delete(oldestKey);
    if (entry?.body) cacheState.bytes -= entry.body.length;
  }
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.ENC_PASSPHRASE,
  );
}

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      "Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME in .env",
    );
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME };
}

/**
 * Optional R2_FOLDER env var: every object (`.gpg` files and index.json) is
 * stored under `<folder>/` inside the bucket. Empty means bucket root.
 */
function fullKey(key: string): string {
  const folder = (process.env.R2_FOLDER ?? "").trim().replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${key}` : key;
}

function getClient(): S3Client {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = config();
  if (!client) {
    // R2_ENDPOINT is optional; it lets you test against a local S3-compatible
    // mock (see scripts/mock-r2.mjs) instead of real Cloudflare R2.
    const customEndpoint = process.env.R2_ENDPOINT;
    client = new S3Client({
      region: "auto",
      endpoint:
        customEndpoint ??
        `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: Boolean(customEndpoint),
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  const { R2_BUCKET_NAME } = config();
  const full = fullKey(key);
  await getClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: full,
      Body: body,
    }),
  );
  // Write-through: a subsequent read of the same key must see what we wrote.
  cacheSet(full, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  const { R2_BUCKET_NAME } = config();
  const full = fullKey(key);
  const cached = cacheGet(full);
  if (cached !== undefined) return cached;
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: full }),
    );
    const body = res.Body
      ? Buffer.from(await res.Body.transformToByteArray())
      : null;
    cacheSet(full, body);
    return body;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NoSuchKey" || name === "NotFound") {
      // Cache the absence too: a missing index/lock is the common cold state.
      cacheSet(full, null);
      return null;
    }
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { R2_BUCKET_NAME } = config();
  const full = fullKey(key);
  await getClient().send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: full }),
  );
  // Reflect the deletion so reads don't re-fetch to rediscover it's gone.
  cacheSet(full, null);
}
