import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";
import { pingDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getDashboardStats();
  const dbConnected = await pingDb();
  return NextResponse.json({ ...stats, dbConnected });
}
