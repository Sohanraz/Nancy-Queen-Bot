import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";
import { isDashboardAuthenticated } from "@/lib/dashboard-auth";
import { pingDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getDashboardStats();
  const dbConnected = await pingDb();
  return NextResponse.json({ ...stats, dbConnected });
}
