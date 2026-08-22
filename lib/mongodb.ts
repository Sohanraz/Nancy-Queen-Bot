import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "nancy_queen";

if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}

type GlobalMongo = typeof globalThis & {
  __nancyMongoClient?: MongoClient;
  __nancyMongoPromise?: Promise<MongoClient>;
};

const globalMongo = globalThis as GlobalMongo;

const clientPromise =
  globalMongo.__nancyMongoPromise ??
  (globalMongo.__nancyMongoPromise = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
  }).connect());

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  globalMongo.__nancyMongoClient = client;
  return client.db(dbName);
}

export async function pingDb(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
