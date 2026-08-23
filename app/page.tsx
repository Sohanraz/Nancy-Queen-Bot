import DashboardClient from "./dashboard-client";
import LoginClient from "./login-client";
import { isDashboardAuthenticated } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authenticated = await isDashboardAuthenticated();
  return authenticated ? <DashboardClient /> : <LoginClient />;
}
