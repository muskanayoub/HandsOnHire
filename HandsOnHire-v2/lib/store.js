'use strict';
/** Tiny JSON-file database. Fine for a prototype; swap for SQLite/Postgres in production. */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.HOH_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = () => ({
  workers: [],
  ratings: [],          // { workerId, employerHash, stars, comment, at }
  reports: [],          // { workerId, employerHash, reason, details, at }
  contacts: [],         // { id, workerId, employerHash, employerMask, at }
  employerReports: [],  // { contactId, workerId, employerHash, reason, at }
  blockedEmployers: [], // employer hashes
});

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return EMPTY();
  try {
    return { ...EMPTY(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch (e) {
    console.error('db.json is unreadable, starting fresh:', e.message);
    return EMPTY();
  }
}

function save(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic replace
}

module.exports = { load, save, DATA_DIR };
