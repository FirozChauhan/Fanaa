/**
 * The app version shown next to the logo. Inlined at build time by
 * next.config.ts into NEXT_PUBLIC_APP_VERSION — resolution order: explicit
 * env var → closest git tag → package.json "version" → "dev".
 *
 * Server-only: must only be imported from server components/route handlers.
 */
export function gitVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || "dev";
}