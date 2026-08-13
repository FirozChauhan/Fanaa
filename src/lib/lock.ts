import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { getObject, putObject } from "./r2";

/**
 * App lock PIN, stored as an scrypt hash in `lock.json` in the bucket.
 *
 * The PIN is UI-level protection for the running app (the journal content is
 * already gpg-encrypted at rest). The hash is salted and never stored
 * plaintext; verification happens server-side so the PIN never travels as a
 * usable credential.
 */
const LOCK_KEY = "lock.json";

const KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 64;

type LockRecord = {
  salt: string; // hex
  hash: string; // hex
  N: number;
  r: number;
  p: number;
};

function derive(
  pin: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LEN, { N: n, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export function isValidPin(pin: string): boolean {
  return (
    pin.length >= MIN_PIN_LENGTH && pin.length <= MAX_PIN_LENGTH
  );
}

export async function isPinConfigured(): Promise<boolean> {
  return (await getObject(LOCK_KEY)) !== null;
}

async function readRecord(): Promise<LockRecord | null> {
  const raw = await getObject(LOCK_KEY);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw.toString("utf8")) as LockRecord;
    if (typeof rec.salt !== "string" || typeof rec.hash !== "string") {
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error(
      `PIN must be ${MIN_PIN_LENGTH}–${MAX_PIN_LENGTH} characters`,
    );
  }
  const salt = randomBytes(16);
  const hash = await derive(pin, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  const rec: LockRecord = {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  };
  await putObject(LOCK_KEY, Buffer.from(JSON.stringify(rec), "utf8"));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const rec = await readRecord();
  if (!rec) return false;
  const salt = Buffer.from(rec.salt, "hex");
  const expected = Buffer.from(rec.hash, "hex");
  const actual = await derive(pin, salt, rec.N || SCRYPT_N, rec.r || SCRYPT_R, rec.p || SCRYPT_P);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
