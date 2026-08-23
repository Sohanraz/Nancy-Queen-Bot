import { NextRequest } from "next/server";
import { setDashboardSession, verifyDashboardPassword } from "@/lib/dashboard-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!verifyDashboardPassword(String(body?.password || ""))) {
      return Response.json({ ok: false, error: "Invalid password" }, { status: 401 });
    }
    await setDashboardSession();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Login failed" }, { status: 500 });
  }
}
