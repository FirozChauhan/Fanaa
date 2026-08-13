import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolve the app version for the logo label, baked in at build time:
 *   1. an explicit NEXT_PUBLIC_APP_VERSION env var (e.g. set in Render),
 *   2. the closest git tag reachable from HEAD (e.g. "v1.1.1"),
 *   3. package.json "version" (always shipped in the repo — works on
 *      Render/Docker, where .git and tags aren't available at build time),
 *   4. "dev" as a last resort.
 */
function currentVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  // Note: NO `--always` here. With `--always` git silently falls back to the
  // bare commit SHA with exit 0 when no tags exist (exactly what happens on
  // Render, which doesn't fetch tags) — so the fallback below would never run.
  // Without it, a tag-less repo fails loudly and we drop through to
  // package.json instead of showing a cryptig-looking commit hash.
  try {
    const describe = execSync("git describe --tags", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (describe) return describe;
  } catch {
    /* no .git / no reachable tags in this environment (e.g. Render) */
  }
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version) {
      return `v${pkg.version}`;
    }
  } catch {
    /* nothing to read */
  }
  return "dev";
}

const nextConfig: NextConfig = {
  // Bake the version into the bundle at build time — the label is constant for
  // a given build and never depends on whether .git/tags exist at runtime.
  env: {
    NEXT_PUBLIC_APP_VERSION: currentVersion(),
  },
  // Baseline security headers. A full CSP is intentionally omitted: the
  // markdown editor relies on dynamic inline styles which a strict policy
  // would break — revisit if the app grows a stricter origin model.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;