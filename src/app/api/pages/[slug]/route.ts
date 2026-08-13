import { NextResponse } from "next/server";
import { deletePage, getPage, isValidSlug, updatePage } from "@/lib/pages";
import { isLineHeight } from "@/lib/line-height";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

async function slugFrom(ctx: Ctx): Promise<string | null> {
  const { slug } = await ctx.params;
  return isValidSlug(slug) ? slug : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const denied = await authGuard();
  if (denied) return denied;
  const slug = await slugFrom(ctx);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  try {
    const page = await getPage(slug);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to load page" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const denied = await authGuard();
  if (denied) return denied;
  const slug = await slugFrom(ctx);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  try {
    const body = (await req.json()) as {
      content?: unknown;
      date?: unknown;
      lineHeight?: unknown;
    };
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    const date =
      body.date === null || typeof body.date === "string" ? body.date : undefined;
    // Only known presets or an explicit clear are accepted — never junk.
    const lineHeight =
      body.lineHeight === null || isLineHeight(body.lineHeight)
        ? body.lineHeight
        : undefined;
    const page = await updatePage(slug, body.content, date, lineHeight);
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to save page" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await authGuard();
  if (denied) return denied;
  const slug = await slugFrom(ctx);
  if (!slug) return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  try {
    await deletePage(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to delete page" },
      { status: 500 },
    );
  }
}
