import { NextResponse } from "next/server";

const VALID_LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es"];

export async function POST(request: Request) {
  const { locale } = await request.json();
  if (!locale || !VALID_LOCALES.includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("SERIEZ_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
