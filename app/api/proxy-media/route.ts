import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeRemote(url: string) {
  const u = new URL(url);
  return u.protocol === "https:" && /(^|\.)alightcreative\.com$/i.test(u.hostname);
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url wajib diisi" }, { status: 400 });
  try {
    if (!safeRemote(target)) return NextResponse.json({ error: "Sumber media tidak diizinkan" }, { status: 400 });
    const upstream = await fetch(target, { cache: "no-store", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 PresetWebEditor/2.0" } });
    if (!upstream.ok) return NextResponse.json({ error: `Media HTTP ${upstream.status}` }, { status: 502 });
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("cache-control", "public, max-age=3600");
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Media tidak dapat diambil." }, { status: 500 });
  }
}
