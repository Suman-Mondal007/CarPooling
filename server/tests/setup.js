import fs from 'fs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';

// Auto-detect local MongoDB on Windows to avoid downloading huge binaries
if (!process.env.MONGOMS_SYSTEM_BINARY) {
  const localCandidates = [
    'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe'
  ];
  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      process.env.MONGOMS_SYSTEM_BINARY = candidate;
      break;
    }
  }
}

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });

  const uri = replSet.getUri();
  await connectDB(uri);
}, 60000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  await disconnectDB();
  if (replSet) {
    await replSet.stop();
  }
}, 60000);
