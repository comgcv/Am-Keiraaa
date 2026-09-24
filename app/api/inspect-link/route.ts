import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowed(host: string) {
  return /(^|\.)alightcreative\.com$/i.test(host) || /(^|\.)alightmotion\.com$/i.test(host);
}
function safeAbsolute(value: string, base: string) {
  try {
    const u = new URL(value, base);
    if (u.protocol === "https:" && allowed(u.hostname)) return u.toString();
  } catch {}
  return null;
}
function xmlCandidates(text: string, base: string) {
  const set = new Set<string>();
  const absolute = /https?:\/\/[^"'<> \t\r\n]+/gi;
  let m: RegExpExecArray | null;
  while ((m = absolute.exec(text))) {
    const u = safeAbsolute(m[0].replace(/&amp;/g, "&"), base);
    if (u && /\.xml(?:[?#]|$)/i.test(u)) set.add(u);
  }
  const attr = /(?:href|src|url|download|xmlUrl|xml_url|projectUrl|project_url|assetUrl|asset_url)\s*[:=]\s*["']([^"']+)["']/gi;
  while ((m = attr.exec(text))) {
    const u = safeAbsolute(m[1].replace(/&amp;/g, "&"), base);
    if (u && /\.xml(?:[?#]|$)/i.test(u)) set.add(u);
  }
  return [...set];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = String(body?.url ?? "").trim();
    const input = new URL(raw);
    if (input.protocol !== "https:" || !allowed(input.hostname)) {
      return NextResponse.json({ error: "Link harus berasal dari alightcreative.com." }, { status: 400 });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(input.toString(), { redirect: "follow", cache: "no-store", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 PresetWebEditor/2.0" } });
    } finally { clearTimeout(timer); }
    const finalUrl = response.url || input.toString();
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!response.ok) return NextResponse.json({ error: `Server Alight Motion HTTP ${response.status}.` }, { status: 502 });
    if (/xml/i.test(contentType) || /^\s*<\?xml|<scene\b/i.test(text)) return NextResponse.json({ xml: text, sourceUrl: finalUrl });
    const candidates = xmlCandidates(text, finalUrl);
    for (const candidate of candidates.slice(0, 5)) {
      try {
        const r = await fetch(candidate, { redirect: "follow", cache: "no-store", headers: { "user-agent": "Mozilla/5.0 PresetWebEditor/2.0" } });
        if (!r.ok) continue;
        const xml = await r.text();
        if (/^\s*<\?xml|<scene\b/i.test(xml)) return NextResponse.json({ xml, sourceUrl: candidate, candidates });
      } catch {}
    }
    return NextResponse.json({ error: "Share link berhasil dibuka, tetapi XML project tidak tersedia sebagai file publik yang bisa diambil server. Gunakan OPEN XML untuk file XML yang sudah diekspor dari project.", sourceUrl: finalUrl, candidates }, { status: 422 });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Pengambilan preset timeout." : error instanceof Error ? error.message : "Gagal mengambil preset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
