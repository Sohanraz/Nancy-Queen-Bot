import { NextRequest } from "next/server";
import { bot, processUpdate } from "@/lib/telegram";
import { installTelegramCompat } from "@/lib/telegram-compat";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

installTelegramCompat();

async function enforceMustJoin(update: any) {
  const required = process.env.MUST_JOIN?.replace(/^@/, "").trim();
  const message = update?.message;
  if (!required || !message || message.chat?.type !== "private" || !message.from) return true;

  try {
    const member: any = await bot.api.getChatMember(required, message.from.id);
    const allowed = member.status === "member" || member.status === "administrator" || member.status === "creator";
    if (allowed) return true;

    let link = required.match(/^[-]?\d+$/) ? undefined : `https://t.me/${required}`;
    try {
      const chat: any = await bot.api.getChat(required);
      link = chat.invite_link || link;
    } catch {
      // Keep the public username link when available.
    }

    await bot.api.sendMessage(
      message.chat.id,
      "You must join <b>the required channel</b> to use me. After joining, try again!",
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: link ? { inline_keyboard: [[{ text: "✨ Join Channel ✨", url: link }]] } : undefined,
      },
    );
    return false;
  } catch {
    // Match the old bot: if the membership check cannot be performed, do not block the user.
    return true;
  }
}

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return Response.json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET is not configured" }, { status: 500 });
  const supplied = request.headers.get("x-telegram-bot-api-secret-token");
  if (supplied !== expected) return Response.json({ ok: false }, { status: 401 });

  try {
    await initDb();
    const update = await request.json();
    if (!(await enforceMustJoin(update))) return Response.json({ ok: true, skipped: true });
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
