import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Writable } from "node:stream";

function passphrase(): string {
  const p = process.env.ENC_PASSPHRASE;
  if (!p) {
    throw new Error("ENC_PASSPHRASE is not set. Add it to your .env file.");
  }
  return p;
}

/**
 * A writable, empty gpg home directory.
 *
 * gpg needs a home dir for lock files even for pure symmetric operations. On
 * serverless hosts (Vercel) HOME can point at a non-existent path and the
 * filesystem is read-only except /tmp, so gpg dies with `can't create
 * directory '$HOME/.gnupg'`. Creating a scratch home under the OS temp dir
 * sidesteps that everywhere (local, Render, Vercel) — no keyring is needed
 * for --symmetric, so the dir can be empty.
 */
function scratchGnupgHome(): string {
  return mkdtempSync(join(tmpdir(), "fanaa-gnupg-"));
}

/**
 * Run gpg as a local subprocess.
 *
 * The plaintext/ciphertext flows through stdin/stdout; the passphrase is fed
 * on file descriptor 3 so it never appears in argv or on stdin.
 */
function runGpg(args: string[], input: Buffer | string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "gpg",
      [
        "--batch",
        "--yes",
        "--pinentry-mode",
        "loopback",
        "--passphrase-fd",
        "3",
        "--homedir",
        scratchGnupgHome(),
        ...args,
      ],
      { stdio: ["pipe", "pipe", "pipe", "pipe"] },
    );

    const out: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout?.on("data", (d: Buffer) => out.push(d));
    child.stderr?.on("data", (d: Buffer) => errChunks.push(d));
    // Swallow stream errors (e.g. gpg missing) so they can't crash the server.
    child.stdin?.on("error", () => {});
    (child.stdio[3] as Writable | undefined)?.on("error", () => {});
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(
          new Error(
            `gpg exited with code ${code}: ${Buffer.concat(errChunks)
              .toString()
              .trim()}`,
          ),
        );
      }
    });

    (child.stdio[3] as Writable | undefined)?.end(passphrase());
    child.stdin?.end(input);
  });
}

/** Encrypt UTF-8 text into a binary AES-256 encrypted .gpg blob. */
export async function encrypt(plaintext: string): Promise<Buffer> {
  return runGpg(["--symmetric", "--cipher-algo", "AES256"], plaintext);
}

/** Decrypt a .gpg blob produced by {@link encrypt} back into UTF-8 text. */
export async function decrypt(ciphertext: Buffer): Promise<string> {
  const out = await runGpg(["--decrypt"], ciphertext);
  return out.toString("utf8");
}
