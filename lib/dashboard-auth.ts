import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "nancy_dashboard_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.DASHBOARD_SESSION_SECRET || process.env.BOT_SETUP_SECRET;
  if (!value) throw new Error("DASHBOARD_SESSION_SECRET is not configured");
  return value;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionValue() {
  const payload = `${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isValid(value?: string) {
  if (!value) return false;
  const [timestamp, signature] = value.split(".");
  if (!timestamp || !signature) return false;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE * 1000) return false;
  return safeEqual(signature, sign(timestamp));
}

export async function isDashboardAuthenticated() {
  const store = await cookies();
  return isValid(store.get(COOKIE)?.value);
}

export async function setDashboardSession() {
  const store = await cookies();
  store.set(COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearDashboardSession() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function verifyDashboardPassword(password: string) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !password) return false;
  return safeEqual(password, expected);
}
