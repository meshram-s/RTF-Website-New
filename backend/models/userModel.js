// models/userModel.js
// ─────────────────────────────────────────────────────────────
// This is a "model" for a NoSQL database — NOT a schema class like
// you'd get from Mongoose. It's just: (1) a documented shape for
// what lives at /users/{uid}, and (2) plain functions that are the
// ONLY way the rest of the app reads/writes that path.
//
// Full schema reference: docs/firebase-schema.md
//
// RULE: controllers never call `db.ref(...)` directly. They only
// ever call functions from a model file. This is what keeps 20
// different people's code writing the SAME shape of data.
// ─────────────────────────────────────────────────────────────

// const { db } = require('../config/firebaseAdmin');
// // const { sanitizeEmail } = require('../utils/sanitizeEmail');
// const sanitizeEmail = require('../utils/sanitizeEmail');
/**
 * Shape stored at /users/{uid}:
 * {
 *   name, collegeEnrollmentNo, collegeEmail, personalEmail,
 *   branch, yearOfPassing, phone, domain, role, status,
 *   passwordHash, rtfId, createdAt, approvedBy
 * }
 */

/**
 * Checks whether a personal email is already registered.
 * Uses the /usersByEmail index instead of scanning all users —
 * O(1) lookup instead of O(n).
 * @param {string} personalEmail
 * @returns {Promise<boolean>}
 */
// async function emailExists(personalEmail) {
//   const key = sanitizeEmail(personalEmail);
//   const snapshot = await db.ref(`usersByEmail/${key}`).get();
//   return snapshot.exists();
// }

/**
 * Creates a new user. Writes to BOTH /users/{uid} and
 * /usersByEmail/{sanitized} in a single atomic multi-path update,
 * so the two paths can never go out of sync (e.g. server crashes
 * between two separate writes).
 *
 * @param {object} userData - everything except uid (uid is generated here)
 * @returns {Promise<{ uid: string }>}
 */
// async function createUser(userData) {
//   const newUserRef = db.ref('users').push(); // generates a unique uid
//   const uid = newUserRef.key;

//   const record = {
//     ...userData,
//     status: 'pending', // every new registration starts pending admin approval
//     rtfId: null,        // assigned later, on approval
//     createdAt: Date.now(),
//     approvedBy: null,
//   };

//   const sanitizedKey = sanitizeEmail(userData.personalEmail);

//   // Multi-path update — Firebase applies both writes together or neither.
//   const updates = {};
//   updates[`users/${uid}`] = record;
//   updates[`usersByEmail/${sanitizedKey}`] = uid;

//   await db.ref().update(updates);

//   return { uid };
// }

/**
 * Fetches a user by their uid.
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
// async function getUserByUid(uid) {
//   const snapshot = await db.ref(`users/${uid}`).get();
//   return snapshot.exists() ? snapshot.val() : null;
// }

/**
 * Fetches a user by personal email — used at login.
 * Two-step lookup: sanitized email → uid, then uid → full record.
 * @param {string} personalEmail
 * @returns {Promise<object|null>} the user record WITH uid attached, or null
 */

// models/userModel.js
// Require 'db' directly from config/firebaseAdmin
// const { db } = require('../config/firebaseAdmin'); 
// const sanitizeEmail = require('../utils/sanitizeEmail');

// /**
//  * Creates a new user in /users/{uid} and creates an index in /usersByEmail/{sanitizedEmail}
//  */
// const createUser = async (userData) => {
//   // Check if DB is initialized
//   if (!db) {
//     throw new Error('Database is not initialized. Check your .env Firebase credentials.');
//   }

//   // Generate a new Push ID key for UID
//   const uid = db.ref('users').push().key;
//   const sanitizedEmail = sanitizeEmail(userData.personalEmail);

//   const userPayload = {
//     name: userData.name || '',
//     collegeEnrollmentNo: userData.collegeEnrollmentNo || '',
//     collegeEmail: userData.collegeEmail || '',
//     personalEmail: userData.personalEmail,
//     branch: userData.branch || '',
//     yearOfPassing: Number(userData.yearOfPassing) || null,
//     phone: userData.phone || '',
//     domain: userData.domain, // 'software' | 'electrical' | 'aeromech'
//     role: userData.role || 'member', // 'member' | 'admin' | 'superadmin'
//     status: userData.status || 'pending', // 'pending' | 'active' | 'rejected'
//     passwordHash: userData.passwordHash,
//     rtfId: userData.rtfId || null,
//     createdAt: Date.now(),
//     approvedBy: userData.approvedBy || null,
//   };

//   // Atomic Multi-Path Update
//   const updates = {};
//   updates[`/users/${uid}`] = userPayload;
//   updates[`/usersByEmail/${sanitizedEmail}`] = uid;

//   await db.ref().update(updates);
//   return { uid, ...userPayload };
// };

// /**
//  * Fast O(1) lookup to find UID by personalEmail
//  */
// const getUserByEmail = async (email) => {
//   if (!db) {
//     throw new Error('Database is not initialized. Check your .env Firebase credentials.');
//   }

//   const sanitizedEmail = sanitizeEmail(email);
//   const snapshot = await db.ref(`usersByEmail/${sanitizedEmail}`).once('value');
  
//   if (!snapshot.exists()) return null;

//   const uid = snapshot.val();
//   const userSnapshot = await db.ref(`users/${uid}`).once('value');
  
//   if (!userSnapshot.exists()) return null;

//   return { uid, ...userSnapshot.val() };
// };

// /**
//  * Retrieves a user directly by their UID from /users/{uid}
//  */
// const getUserById = async (uid) => {
//   if (!db) {
//     throw new Error('Database is not initialized. Check your .env Firebase credentials.');
//   }

//   const snapshot = await db.ref(`users/${uid}`).once('value');
//   if (!snapshot.exists()) return null;

//   return { uid, ...snapshot.val() };
// };

// /**
//  * Updates specific user fields in /users/{uid}
//  */
// const updateUser = async (uid, updateData) => {
//   if (!db) {
//     throw new Error('Database is not initialized. Check your .env Firebase credentials.');
//   }

//   await db.ref(`users/${uid}`).update(updateData);
//   return true;
// };

// module.exports = {
//   createUser,
//   getUserByEmail,
//   getUserById,
//   updateUser,
// };

// new

// models/userModel.js
// Require 'db' directly from config/firebaseAdmin
const { db } = require('../config/firebaseAdmin'); 
const sanitizeEmail = require('../utils/sanitizeEmail');

/**
 * Creates a new user under /users/{yearOfPassing}/{rtfId} 
 * and creates an email index in /usersByEmail/{sanitizedEmail}
 */
const createUser = async (userData) => {
  // Check if DB is initialized
  if (!db) {
    throw new Error('Database is not initialized. Check your .env Firebase credentials.');
  }

  const yearOfPassing = Number(userData.yearOfPassing);
  const rtfId = userData.rtfId;

  if (!yearOfPassing || !rtfId) {
    throw new Error('yearOfPassing and rtfId are required to structure the user node.');
  }

  const sanitizedEmail = sanitizeEmail(userData.personalEmail);

  const userPayload = {
    name: userData.name || '',
    collegeEnrollmentNo: userData.collegeEnrollmentNo || '',
    collegeEmail: userData.collegeEmail || '',
    personalEmail: userData.personalEmail,
    branch: userData.branch || '',
    yearOfPassing: yearOfPassing,
    phone: userData.phone || '',
    domain: userData.domain, // 'software' | 'mechanical' | 'electronics' | 'aero'
    role: userData.role || 'member', // 'member' | 'admin' | 'superadmin'
    status: userData.status || 'pending', // 'pending' | 'active' | 'rejected'
    passwordHash: userData.passwordHash,
    rtfId: rtfId,
    createdAt: Date.now(),
    approvedBy: userData.approvedBy || null,
  };

  // Atomic Multi-Path Update
  // 1. Save user under /users/<yearOfPassing>/<rtfId>
  // 2. Save location pointer under /usersByEmail/<sanitizedEmail>
  const updates = {};
  updates[`/users/${yearOfPassing}/${rtfId}`] = userPayload;
  updates[`/usersByEmail/${sanitizedEmail}`] = { yearOfPassing, rtfId };

  await db.ref().update(updates);
  return { rtfId, ...userPayload };
};

/**
 * Fast O(1) lookup to find user location by personalEmail
 */
const getUserByEmail = async (email) => {
  if (!db) {
    throw new Error('Database is not initialized. Check your .env Firebase credentials.');
  }

  const sanitizedEmail = sanitizeEmail(email);
  const snapshot = await db.ref(`usersByEmail/${sanitizedEmail}`).once('value');
  
  if (!snapshot.exists()) return null;

  // Pointer stores { yearOfPassing, rtfId }
  const { yearOfPassing, rtfId } = snapshot.val();
  const userSnapshot = await db.ref(`users/${yearOfPassing}/${rtfId}`).once('value');
  
  if (!userSnapshot.exists()) return null;

  return { rtfId, ...userSnapshot.val() };
};

/**
 * Retrieves a user directly by their yearOfPassing and rtfId from /users/{yearOfPassing}/{rtfId}
 */
const getUserById = async (yearOfPassing, rtfId) => {
  if (!db) {
    throw new Error('Database is not initialized. Check your .env Firebase credentials.');
  }

  const snapshot = await db.ref(`users/${yearOfPassing}/${rtfId}`).once('value');
  if (!snapshot.exists()) return null;

  return { rtfId, ...snapshot.val() };
};

/**
 * Updates specific user fields in /users/{yearOfPassing}/{rtfId}
 */
const updateUser = async (yearOfPassing, rtfId, updateData) => {
  if (!db) {
    throw new Error('Database is not initialized. Check your .env Firebase credentials.');
  }

  await db.ref(`users/${yearOfPassing}/${rtfId}`).update(updateData);
  return true;
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
};