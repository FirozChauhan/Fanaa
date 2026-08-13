import { NextResponse } from "next/server";
import {
  createPage,
  deletePage,
  isValidSlug,
  listPages,
} from "@/lib/pages";
import { authGuard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    const pages = await listPages();
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to list pages" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      content?: unknown;
      date?: unknown;
    };
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    const date =
      body.date === null || typeof body.date === "string" ? body.date : undefined;
    const page = await createPage(body.content, date);
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to create page" },
      { status: 500 },
    );
  }
}

/** Bulk delete used by the home list's multi-select mode. */
export async function DELETE(req: Request) {
  const denied = await authGuard();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { slugs?: unknown };
    const slugs = Array.isArray(body.slugs)
      ? body.slugs.filter(
          (s): s is string => typeof s === "string" && isValidSlug(s),
        )
      : [];
    if (slugs.length === 0) {
      return NextResponse.json({ error: "No valid slugs" }, { status: 400 });
    }
    // Content files are independent; the index lock serializes metadata.
    // allSettled: a single failure must not mask the deletions that did
    // succeed (deletePage is idempotent, so retrying is always safe).
    const results = await Promise.allSettled(slugs.map(deletePage));
    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = slugs.length - failed;
    if (deleted === 0) {
      return NextResponse.json(
        { error: "Failed to delete pages" },
        { status: 500 },
      );
    }
    return NextResponse.json({ deleted, failed });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to delete pages" },
      { status: 500 },
    );
  }
}
