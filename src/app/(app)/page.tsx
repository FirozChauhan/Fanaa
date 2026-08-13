import Link from "next/link";
import { isPinConfigured } from "@/lib/lock";
import { isR2Configured } from "@/lib/r2";
import { listPages, totalWords } from "@/lib/pages";
import { activityDays, computeStreak, dayKeyOf, toKey } from "@/lib/stats";
import HomeMain from "@/components/HomeMain";
import PinBanner from "@/components/PinBanner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const configured = isR2Configured();

  let pages: Awaited<ReturnType<typeof listPages>> = [];
  let error: string | null = null;
  let stats = { entries: 0, words: 0, streak: 0, today: 0 };
  let pinConfigured = false;

  if (configured) {
    try {
      const [pagesNow, pinNow] = await Promise.all([
        listPages(),
        isPinConfigured(),
      ]);
      pages = pagesNow;
      pinConfigured = pinNow;
      const today = toKey(new Date());
      stats = {
        entries: pages.length,
        words: await totalWords(),
        streak: computeStreak(activityDays(pages)),
        today: pages.filter((p) => dayKeyOf(p) === today).length,
      };
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col">
        {!configured ? (
          <section className="term-dialog mx-auto mt-8 w-full max-w-xl p-5 text-sm leading-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-term-red">
              ! storage not configured
            </p>
            <p className="mt-3 text-term-dim">
              add these variables to{" "}
              <code className="term-input px-1.5 py-0.5">.env</code> and
              restart the dev server:
            </p>
            <pre className="mt-3 overflow-x-auto border border-line bg-page p-4 text-xs leading-6 text-term">
              {[
                "R2_ACCOUNT_ID=",
                "R2_ACCESS_KEY_ID=",
                "R2_SECRET_ACCESS_KEY=",
                "R2_BUCKET_NAME=",
                "R2_FOLDER=        # optional: subfolder for all objects",
                "ENC_PASSPHRASE=",
              ].join("\n")}
            </pre>
            <p className="mt-3 text-xs text-term-faint">
              see <code className="text-term-dim">.env.example</code> in the
              project root.
            </p>
          </section>
        ) : error ? (
          <section className="term-dialog mx-auto mt-8 w-full max-w-xl p-5 text-sm leading-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-term-red">
              $ r2 status
            </p>
            <p className="mt-3 text-term-dim">{error}</p>
            <Link href="/" className="term-btn mt-4">
              retry
            </Link>
          </section>
        ) : (
          <>
            {!pinConfigured && <PinBanner />}
            <HomeMain pages={pages} stats={stats} />
          </>
        )}
      </main>
    </>
  );
}
