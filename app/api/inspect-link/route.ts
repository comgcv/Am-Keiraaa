import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = String(body?.url ?? "").trim();
    const url = new URL(raw);

    if (!/(^|\.)alightcreative\.com$/i.test(url.hostname)) {
      return NextResponse.json(
        { error: "URL harus berasal dari alightcreative.com." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      host: url.hostname,
      path: url.pathname,
      message:
        "Link valid terdeteksi. Endpoint ini tidak membypass private/internal access. Untuk membaca timeline dan asset asli, gunakan project package/XML yang memang dapat diakses oleh pengguna."
    });
  } catch {
    return NextResponse.json(
      { error: "URL tidak valid." },
      { status: 400 }
    );
  }
}