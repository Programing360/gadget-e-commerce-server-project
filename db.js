const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = `mongodb+srv://${process.env.DB_GEROMIROO}:${process.env.DB_PASS}@cluster0.3036qk8.mongodb.net/?appName=Cluster0`;

let cachedClient = null;
let cachedDb = null;

async function connectDB() {
  if (cachedClient && cachedDb) {
    return cachedDb; // ✅ db return করছে
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await client.connect();

  cachedClient = client;
  cachedDb = client.db("zeroomiro"); // ✅ database name সঠিক কিনা দেখুন

  return cachedDb; // ✅ db return
}

module.exports = { connectDB };