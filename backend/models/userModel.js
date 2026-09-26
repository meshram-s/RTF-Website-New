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
// const sanitizeEmail = require('../utils/sanitizeEmail');
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
 * Email uniqueness is claimed atomically using a Firebase
 * transaction so concurrent registrations cannot claim
 * the same email.
 *
 * @param {object} userData
 * @returns {Promise<{uid: string, rtfId: string}>}
 */
async function createUser(userData) {
  // Generate a unique Firebase UID.
  const uid = db.ref('users').push().key;

  const sanitizedKey =
    sanitizeEmail(userData.personalEmail);

  // ---------------------------------------------------------
  // 1. Atomically claim the email address
  // ---------------------------------------------------------
  //
  // If the email is empty, store our UID.
  // If another user already owns it, keep the existing UID.
  //
  // This prevents two concurrent registrations from both
  // successfully claiming the same email.
  const emailRef =
    db.ref(`usersByEmail/${sanitizedKey}`);

  const emailTransaction =
    await emailRef.transaction((current) => {
      if (current === null) {
        return uid;
      }

      // Email is already claimed.
      return current;
    });

  const claimedUid =
    emailTransaction.snapshot.val();

  if (
    !emailTransaction.committed ||
    claimedUid !== uid
  ) {
    const err = new Error(
      'An account with this email already exists'
    );
    err.statusCode = 409;
    throw err;
  }

  // ---------------------------------------------------------
  // 2. Domain code for RTF ID
  // ---------------------------------------------------------
  const DOMAIN_CODE_MAP = {
    software: 'SD',
    electronics: 'ED',
    aeromech: 'AMD',
  };

  const code = DOMAIN_CODE_MAP[userData.domain];

  if (!code) {
    // Release the email claim because user creation
    // cannot continue.
    await emailRef.transaction((current) => {
      return current === uid ? null : current;
    });

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

  // ---------------------------------------------------------
  // 3. Atomically get the next RTF serial number
  // ---------------------------------------------------------
  const counterRef =
    db.ref(`counters/${domainYearKey}`);

  const transactionResult =
    await counterRef.transaction((current) => {
      return (current || 0) + 1;
    });

  if (!transactionResult.committed) {
    // Release the email claim if RTF ID generation fails.
    await emailRef.transaction((current) => {
      return current === uid ? null : current;
    });

    const err = new Error('Could not generate RTF ID');
    err.statusCode = 500;
    throw err;
  }

  const serial =
    transactionResult.snapshot.val();

  // 01, 02, 03...
  const paddedSerial =
    String(serial).padStart(2, '0');

  // Temporary RTF ID.
  // Example: SD27-T01@RTF
  const rtfId =
    `${code}${yy}-T${paddedSerial}@RTF`;

  // ---------------------------------------------------------
  // 4. Backend-controlled fields
  // ---------------------------------------------------------
  const record = {
    uid,

    ...userData,

    role: 'member',
    status: 'pending',
    rtfId,
    createdAt: Date.now(),
    approvedBy: null,
  };

  // ---------------------------------------------------------
  // 5. Atomic user record write
  // ---------------------------------------------------------
  const updates = {};

  updates[
    `users/${userData.yearOfPassing}/${rtfId}`
  ] = record;

  // Email index has already been claimed atomically.
  // Keep the same UID in the index.
  updates[
    `usersByEmail/${sanitizedKey}`
  ] = uid;

  try {
    await db.ref().update(updates);
  } catch (error) {
    // If the user write fails, release the email claim
    // so the user can try registration again.
    await emailRef.transaction((current) => {
      return current === uid ? null : current;
    });

    throw error;
  }

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

/**
 * Fetches a user by personal email using the /usersByEmail index.
 *
 * @param {string} personalEmail
 * @returns {Promise<object|null>}
 */
async function getUserByEmail(personalEmail) {
  const key = sanitizeEmail(personalEmail);
  const emailSnap = await db.ref(`usersByEmail/${key}`).get();

  if (!emailSnap.exists()) {
    return null;
  }

  const uid = emailSnap.val();
  return await getUserByUid(uid);
}

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
  createUser,
  emailExists,
  getUserByEmail,
  getUserByUid,
  getUserByRtfId,
  rtfIdExists,
};