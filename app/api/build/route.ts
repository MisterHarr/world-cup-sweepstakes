import { NextResponse } from "next/server";

// Never cache — this endpoint is the source of truth for the current build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Vercel injects VERCEL_GIT_COMMIT_SHA on every deploy. Falls back to a
// per-boot timestamp so local dev still sees a stable value during a session.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  String(Date.now());

export async function GET() {
  return new NextResponse(JSON.stringify({ buildId: BUILD_ID }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
