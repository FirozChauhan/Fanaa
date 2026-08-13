import { buildBackupZip } from "@/lib/export";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    const zip = await buildBackupZip();
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="fanaa-backup-${stamp}.zip"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message ?? "Failed to build backup" },
      { status: 500 },
    );
  }
}
