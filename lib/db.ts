import { getDb } from "./mongodb";

export type Position = "below" | "above" | "replace";
export type EditMode = "media" | "all";

export interface UserDoc {
  userId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  channels: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelDoc {
  channelId: number;
  adminId: number;
  title?: string;
  caption?: string | null;
  buttons?: string | null;
  position: Position;
  stickerId?: string | null;
  editMode: EditMode;
  webpagePreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  userId: number;
  action: "add-channel" | "caption" | "buttons" | "sticker";
  channelId?: number;
  expiresAt: Date;
}

interface StatsDoc {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

const counters = [
  "messagesReceived",
  "postsProcessed",
  "postsModified",
  "stickersSent",
  "captionsApplied",
  "buttonsApplied",
  "commandsReceived",
  "channelsAdded",
  "channelsRemoved",
  "errors",
] as const;

export type CounterName = (typeof counters)[number];

let initDbPromise: Promise<void> | undefined;

export function initDb() {
  initDbPromise ??= (async () => {
    const db = await getDb();
    const stats = db.collection<StatsDoc>("stats");
    await Promise.all([
      db.collection<UserDoc>("users").createIndex({ userId: 1 }, { unique: true }),
      db.collection<ChannelDoc>("channels").createIndex({ channelId: 1 }, { unique: true }),
      db.collection<ChannelDoc>("channels").createIndex({ adminId: 1 }),
      db.collection<SessionDoc>("sessions").createIndex({ userId: 1 }, { unique: true }),
      db.collection<SessionDoc>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      stats.updateOne(
        { _id: "global" },
        { $setOnInsert: { _id: "global", createdAt: new Date() } },
        { upsert: true },
      ),
    ]);
  })().catch((error) => {
    initDbPromise = undefined;
    throw error;
  });
  return initDbPromise;
}

export async function ensureUser(userId: number, profile?: Partial<Pick<UserDoc, "firstName" | "lastName" | "username">>) {
  const db = await getDb();
  const now = new Date();
  await db.collection<UserDoc>("users").updateOne(
    { userId },
    {
      $set: {
        updatedAt: now,
        ...(profile?.firstName !== undefined ? { firstName: profile.firstName } : {}),
        ...(profile?.lastName !== undefined ? { lastName: profile.lastName } : {}),
        ...(profile?.username !== undefined ? { username: profile.username } : {}),
      },
      $setOnInsert: { userId, channels: [], createdAt: now },
    },
    { upsert: true },
  );
}

export async function addUserChannel(userId: number, channelId: number) {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne(
    { userId },
    { $addToSet: { channels: channelId }, $set: { updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function removeUserChannel(userId: number, channelId: number) {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne(
    { userId },
    { $pull: { channels: channelId }, $set: { updatedAt: new Date() } },
  );
}

export async function getUserChannels(userId: number): Promise<number[]> {
  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({ userId }, { projection: { channels: 1 } });
  return user?.channels ?? [];
}

export async function getChannel(channelId: number) {
  const db = await getDb();
  return db.collection<ChannelDoc>("channels").findOne({ channelId });
}

export async function upsertChannel(channel: Omit<ChannelDoc, "createdAt" | "updatedAt">) {
  const db = await getDb();
  const now = new Date();
  await db.collection<ChannelDoc>("channels").updateOne(
    { channelId: channel.channelId },
    { $set: { ...channel, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
}

export async function updateChannel(channelId: number, patch: Partial<ChannelDoc>) {
  const db = await getDb();
  await db.collection<ChannelDoc>("channels").updateOne(
    { channelId },
    { $set: { ...patch, updatedAt: new Date() } },
  );
}

export async function removeChannel(channelId: number) {
  const db = await getDb();
  await Promise.all([
    db.collection<ChannelDoc>("channels").deleteOne({ channelId }),
    db.collection<UserDoc>("users").updateMany({}, { $pull: { channels: channelId } }),
  ]);
}

export async function setSession(session: SessionDoc) {
  const db = await getDb();
  await db.collection<SessionDoc>("sessions").updateOne(
    { userId: session.userId },
    { $set: session },
    { upsert: true },
  );
}

export async function getSession(userId: number) {
  const db = await getDb();
  const session = await db.collection<SessionDoc>("sessions").findOne({ userId });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.collection("sessions").deleteOne({ userId });
    return null;
  }
  return session;
}

export async function clearSession(userId: number) {
  const db = await getDb();
  await db.collection("sessions").deleteOne({ userId });
}

export async function incrementStat(name: CounterName, value = 1) {
  const db = await getDb();
  await db.collection<StatsDoc>("stats").updateOne(
    { _id: "global" },
    { $inc: { [name]: value } as any, $set: { updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function getDashboardStats() {
  const db = await getDb();
  const [users, channels, statDoc] = await Promise.all([
    db.collection<UserDoc>("users").countDocuments(),
    db.collection<ChannelDoc>("channels").countDocuments(),
    db.collection<StatsDoc>("stats").findOne({ _id: "global" }),
  ]);

  return {
    users,
    channels,
    messagesReceived: statDoc?.messagesReceived ?? 0,
    postsProcessed: statDoc?.postsProcessed ?? 0,
    postsModified: statDoc?.postsModified ?? 0,
    stickersSent: statDoc?.stickersSent ?? 0,
    captionsApplied: statDoc?.captionsApplied ?? 0,
    buttonsApplied: statDoc?.buttonsApplied ?? 0,
    commandsReceived: statDoc?.commandsReceived ?? 0,
    channelsAdded: statDoc?.channelsAdded ?? 0,
    channelsRemoved: statDoc?.channelsRemoved ?? 0,
    errors: statDoc?.errors ?? 0,
    updatedAt: statDoc?.updatedAt ?? null,
  };
}
