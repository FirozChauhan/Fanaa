import HomeHeader from "@/components/HomeHeader";
import HomeKeyHandler from "@/components/HomeKeyHandler";
import { gitVersion } from "@/lib/git-version";
import { isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isR2Configured();

  return (
    <div className="term-screen flex h-dvh flex-col">
      <HomeHeader version={gitVersion()} storageOk={configured} />
      <div className="mx-auto flex w-[80%] min-h-0 flex-1 flex-col">
        {children}
      </div>
      <footer className="bg-page/95">
        <div className="mx-auto flex w-[80%] flex-col items-center justify-between gap-1.5 border-t border-line-strong py-2 sm:flex-row">
          <p
            dir="rtl"
            className="font-reem-kufi text-base leading-5 text-term-faint"
          >
            زندگی بھی کہیں ملتی ہے فنا سے پہلے۔
          </p>
          <span
            aria-hidden
            dir="rtl"
            className="font-aref-ruqaa text-lg font-bold leading-tight text-term-dim sm:text-xl"
          >
            فیروز خان چوہان
          </span>
        </div>
      </footer>
      <HomeKeyHandler />
    </div>
  );
}
