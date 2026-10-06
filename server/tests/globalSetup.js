import { MongoMemoryServer } from 'mongodb-memory-server-core';

// One in-memory MongoDB for the whole run. Each test file connects to its own
// database on it (see setup.js), so files never see each other's data and no
// developer MongoDB instance is needed.
let mongod;

export async function setup({ provide }) {
  mongod = await MongoMemoryServer.create();
  provide('mongoUri', mongod.getUri());
}

export async function teardown() {
  await mongod?.stop();
}
