import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Cairo, JetBrains_Mono, Reem_Kufi, Aref_Ruqaa } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import KeyGate from "@/components/KeyGate";
import LockScreen from "@/components/LockScreen";
import IdleLock from "@/components/IdleLock";
import { isPinConfigured } from "@/lib/lock";
import { AUTH_COOKIE, authKeyConfigured, isValidSession } from "@/lib/auth";
import "./globals.css";

// The terminal face — every glyph in the app is JetBrains Mono. Preloaded
// (with the automatic fonts.gstatic.com preconnect) so first paint isn't
// waiting on a font file.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// The Arabic logo wordmark (فناء) — Cairo, lazy-loaded.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  preload: false,
});

// Urdu/Arabic footer line.
const reemKufi = Reem_Kufi({
  subsets: ["latin"],
  variable: "--font-reem-kufi",
  preload: false,
});

// Arabic signature font (the footer's maker mark).
const arefRuqaa = Aref_Ruqaa({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-aref-ruqaa",
  preload: false,
});

export const metadata: Metadata = {
  title: "FANAA",
  description:
    "Private journal. Pages are encrypted locally with gpg (AES-256) and stored in Cloudflare R2.",
  applicationName: "FANAA",
};

export const viewport: Viewport = {
  themeColor: "#02110a",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const locked = store.get("ts_lock")?.value === "1";

  const gateEnabled = authKeyConfigured();
  const authed = !gateEnabled || isValidSession(store.get(AUTH_COOKIE)?.value);

  let pinConfigured = false;
  if (locked) {
    try {
      pinConfigured = await isPinConfigured();
    } catch {
      pinConfigured = false;
    }
  }

  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${cairo.variable} ${reemKufi.variable} ${arefRuqaa.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <ToastProvider>
          {!authed ? (
            <KeyGate />
          ) : locked ? (
            <LockScreen configured={pinConfigured} />
          ) : (
            <>
              <IdleLock />
              {children}
            </>
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
