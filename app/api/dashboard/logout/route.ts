import { clearDashboardSession } from "@/lib/dashboard-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearDashboardSession();
  return Response.json({ ok: true });
}
