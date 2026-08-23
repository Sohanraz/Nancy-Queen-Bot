import { NextRequest } from "next/server";
import { configureBot } from "@/lib/telegram";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const setupSecret = process.env.BOT_SETUP_SECRET;
  if (!setupSecret) return Response.json({ error: "BOT_SETUP_SECRET is not configured" }, { status: 500 });

  const supplied = request.headers.get("x-bot-setup-secret");
  if (supplied !== setupSecret) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!baseUrl) return Response.json({ error: "NEXT_PUBLIC_APP_URL or VERCEL_URL is required" }, { status: 500 });

  await initDb();
  const webhookUrl = await configureBot(baseUrl);
  return Response.json({ ok: true, webhookUrl });
}

