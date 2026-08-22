import { NextRequest } from "next/server";
import { processUpdate } from "@/lib/telegram";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const supplied = request.headers.get("x-telegram-bot-api-secret-token");
    if (supplied !== expected) return Response.json({ ok: false }, { status: 401 });
  }

  try {
    await initDb();
    const update = await request.json();
    await processUpdate(update);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, service: "nancy-queen-telegram-webhook" });
}
