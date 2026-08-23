import { MongoClient, Db } from "mongodb";

const dbName = process.env.MONGODB_DB || "nancy_queen";

type GlobalMongo = typeof globalThis & {
  __nancyMongoClient?: MongoClient;
  __nancyMongoPromise?: Promise<MongoClient>;
};

const globalMongo = globalThis as GlobalMongo;

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  globalMongo.__nancyMongoPromise ??= new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
  }).connect().catch((error) => {
    globalMongo.__nancyMongoPromise = undefined;
    throw error;
  });
  return globalMongo.__nancyMongoPromise;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
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
