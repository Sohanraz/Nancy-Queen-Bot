"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  Gauge,
  Hash,
  LogOut,
  MessageSquare,
  Radio,
  Send,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

type Stats = {
  users: number;
  channels: number;
  messagesReceived: number;
  postsProcessed: number;
  postsModified: number;
  stickersSent: number;
  captionsApplied: number;
  buttonsApplied: number;
  commandsReceived: number;
  channelsAdded: number;
  channelsRemoved: number;
  errors: number;
  updatedAt: string | null;
  dbConnected: boolean;
};

function number(value: number) {
  return new Intl.NumberFormat().format(value);
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (response.status === 401) {
        window.location.reload();
        return;
      }
      if (!response.ok) throw new Error("Unable to load stats");
      setStats(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load stats");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function logout() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    window.location.reload();
  }

  const cards = stats ? [
    { label: "Total Users", value: number(stats.users), icon: Users, tone: "violet" },
    { label: "Managed Channels", value: number(stats.channels), icon: Radio, tone: "blue" },
    { label: "Posts Processed", value: number(stats.postsProcessed), icon: Activity, tone: "green" },
    { label: "Posts Modified", value: number(stats.postsModified), icon: CheckCircle2, tone: "amber" },
  ] : [];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small"><Bot size={20} /></div>
          <div><strong>Nancy Queen</strong><span>Bot Dashboard</span></div>
        </div>

        <nav>
          <a className="nav-item active"><Gauge size={17} /> Overview</a>
          <a className="nav-item"><Users size={17} /> Users</a>
          <a className="nav-item"><Radio size={17} /> Channels</a>
          <a className="nav-item"><MessageSquare size={17} /> Activity</a>
        </nav>

        <div className="sidebar-bottom">
          <div className="side-status">
            <span className={stats?.dbConnected ? "dot online" : "dot"}></span>
            <div><strong>{stats?.dbConnected ? "MongoDB connected" : "MongoDB offline"}</strong><span>{stats?.updatedAt ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString()}` : "Waiting for data"}</span></div>
          </div>
          <button className="logout-button" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">OVERVIEW</span>
            <h1>Nancy Queen</h1>
            <p>Telegram channel automation at a glance.</p>
          </div>
          <div className="topbar-actions">
            <span className="live-pill"><span className="dot online"></span> Live</span>
            <div className="admin-pill"><ShieldCheck size={16} /> Admin</div>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {!stats ? (
          <div className="loading-card">Loading dashboard…</div>
        ) : (
          <>
            <section className="stat-grid">
              {cards.map(({ label, value, icon: Icon, tone }) => (
                <div className="stat-card" key={label}>
                  <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
                  <div><span>{label}</span><strong>{value}</strong></div>
                </div>
              ))}
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading"><div><span className="eyebrow">AUTOMATION</span><h2>Activity</h2></div><Activity size={20} /></div>
                <div className="metric-list">
                  <Metric icon={<Send size={16} />} label="Messages received" value={stats.messagesReceived} />
                  <Metric icon={<MessageSquare size={16} />} label="Commands received" value={stats.commandsReceived} />
                  <Metric icon={<CheckCircle2 size={16} />} label="Captions applied" value={stats.captionsApplied} />
                  <Metric icon={<Hash size={16} />} label="URL button sets applied" value={stats.buttonsApplied} />
                  <Metric icon={<Radio size={16} />} label="Stickers sent" value={stats.stickersSent} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading"><div><span className="eyebrow">DATABASE</span><h2>Operations</h2></div><Database size={20} /></div>
                <div className="metric-list">
                  <Metric icon={<Radio size={16} />} label="Channels added" value={stats.channelsAdded} />
                  <Metric icon={<Settings2 size={16} />} label="Channels removed" value={stats.channelsRemoved} />
                  <Metric icon={<ShieldCheck size={16} />} label="Errors recorded" value={stats.errors} />
                  <Metric icon={<Database size={16} />} label="Database" value={stats.dbConnected ? "Connected" : "Offline"} raw />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ icon, label, value, raw = false }: { icon: React.ReactNode; label: string; value: number | string; raw?: boolean }) {
  return <div className="metric-row"><div className="metric-label"><span className="metric-icon">{icon}</span><span>{label}</span></div><strong>{raw ? value : number(value as number)}</strong></div>;
}
