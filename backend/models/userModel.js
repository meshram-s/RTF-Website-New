// models/userModel.js
// ─────────────────────────────────────────────────────────────
// Model functions for Firebase Realtime Database.
//
// User structure:
// /users/{yearOfPassing}/{rtfId}
//
// Email index:
// /usersByEmail/{sanitizedEmail}
//
// Controllers must NOT call db.ref(...) directly.
// ─────────────────────────────────────────────────────────────

const { db } = require('../config/firebaseAdmin');
const { sanitizeEmail } = require('../utils/sanitizeEmail');

/**
 * User structure:
 *
 * /users/{yearOfPassing}/{rtfId}
 *
 * {
 *   uid,
 *   name,
 *   collegeEnrollmentNo,
 *   collegeEmail,
 *   personalEmail,
 *   branch,
 *   yearOfPassing,
 *   phone,
 *   domain,
 *   role,
 *   status,
 *   passwordHash,
 *   rtfId,
 *   createdAt,
 *   approvedBy
 * }
 */

/**
 * Checks whether a personal email is already registered.
 *
 * Uses the /usersByEmail index for O(1) lookup.
 *
 * @param {string} personalEmail
 * @returns {Promise<boolean>}
 */
async function emailExists(personalEmail) {
  const key = sanitizeEmail(personalEmail);

  const snapshot = await db
    .ref(`usersByEmail/${key}`)
    .get();

  return snapshot.exists();
}

/**
 * Creates a new user.
 *
 * New structure:
 *
 * /users/{yearOfPassing}/{rtfId}
 *
 * Also creates:
 *
 * /usersByEmail/{sanitizedEmail}
 *
 * Both writes happen atomically.
 *
 * @param {object} userData
 * @returns {Promise<{uid: string, rtfId: string}>}
 */
async function createUser(userData) {
  // Generate a unique Firebase UID.
  const uid = db.ref('users').push().key;

  // Domain codes used for RTF ID.
  const DOMAIN_CODE_MAP = {
    software: 'SD',
    electrical: 'ED',
    aeromech: 'AMD',
  };

  const code = DOMAIN_CODE_MAP[userData.domain];

  if (!code) {
    const err = new Error('Invalid domain');
    err.statusCode = 400;
    throw err;
  }

  // Last 2 digits of passing year.
  // Example: 2027 -> 27
  const yy = String(userData.yearOfPassing).slice(-2);

  // Counter key.
  // Example: software2027
  const domainYearKey =
    `${userData.domain}${userData.yearOfPassing}`;

  // Atomically get the next serial number.
  const counterRef =
    db.ref(`counters/${domainYearKey}`);

  const transactionResult = await counterRef.transaction(
    (current) => {
      return (current || 0) + 1;
    }
  );

  if (!transactionResult.committed) {
    const err = new Error('Could not generate RTF ID');
    err.statusCode = 500;
    throw err;
  }

  const serial = transactionResult.snapshot.val();

  // 01, 02, 03...
  const paddedSerial =
    String(serial).padStart(2, '0');

  // Temporary RTF ID.
  // Example: SD27-T01@RTF
  const rtfId =
    `${code}${yy}-T${paddedSerial}@RTF`;

  // Backend-controlled fields.
  const record = {
    uid,

    ...userData,

    role: 'member',
    status: 'pending',
    rtfId,
    createdAt: Date.now(),
    approvedBy: null,
  };

  const sanitizedKey =
    sanitizeEmail(userData.personalEmail);

  // Atomic multi-path update.
  const updates = {};

  // NEW USER PATH
  updates[
    `users/${userData.yearOfPassing}/${rtfId}`
  ] = record;

  // EMAIL INDEX
  updates[
    `usersByEmail/${sanitizedKey}`
  ] = uid;

  await db.ref().update(updates);

  return {
    uid,
    rtfId,
  };
}

/**
 * Fetches a user by Firebase UID.
 *
 * Because UID is no longer the Firebase key, we search
 * through the year -> RTF ID structure.
 *
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
async function getUserByUid(uid) {
  const snapshot = await db
    .ref('users')
    .get();

  if (!snapshot.exists()) {
    return null;
  }

  const usersByYear = snapshot.val();

  for (const year of Object.keys(usersByYear)) {
    const users = usersByYear[year];

    if (!users) continue;

    for (const rtfId of Object.keys(users)) {
      const user = users[rtfId];

      if (user && user.uid === uid) {
        return user;
      }
    }
  }

  return null;
}

/**
 * Fetches a user using year of passing + RTF ID.
 *
 * @param {number|string} yearOfPassing
 * @param {string} rtfId
 * @returns {Promise<object|null>}
 */
async function getUserByRtfId(yearOfPassing, rtfId) {
  const snapshot = await db
    .ref(`users/${yearOfPassing}/${rtfId}`)
    .get();

  return snapshot.exists()
    ? snapshot.val()
    : null;
}

/**
 * Checks whether an RTF ID exists for a particular
 * year of passing.
 *
 * @param {number|string} yearOfPassing
 * @param {string} rtfId
 * @returns {Promise<boolean>}
 */
async function rtfIdExists(yearOfPassing, rtfId) {
  const snapshot = await db
    .ref(`users/${yearOfPassing}/${rtfId}`)
    .get();

  return snapshot.exists();
}

module.exports = {
  emailExists,
  createUser,
  getUserByUid,
  getUserByRtfId,
  rtfIdExists,
};