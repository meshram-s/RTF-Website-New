// controllers/authController.js
// ─────────────────────────────────────────────────────────────
// THIS FILE IS THE TEMPLATE. When you build any other module
// (recruitment, mail, room status), copy this same pattern:
//   1. Receive already-validated req.body (validation happened
//      in middleware, BEFORE this function even runs)
//   2. Call model/service functions — never touch Firebase or
//      bcrypt/jwt directly in here
//   3. Return a consistent { success, data } or throw an error
//      with a .statusCode (asyncHandler + errorHandler take it
//      from there)
// ─────────────────────────────────────────────────────────────

const userModel = require('../models/userModel');
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
} = require('../services/authServices');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/auth/register
 * Body (already validated by validateRequest(registerSchema)):
 *   name, collegeEnrollmentNo, collegeEmail, personalEmail,
 *   branch, yearOfPassing, phone, domain, password
 *
 * Flow:
 *   1. Check personalEmail isn't already registered
 *   2. Hash the password (NEVER store it plain)
 *   3. Create the user record (status: "pending")
 *   4. Return success — the frontend shows a
 *      "awaiting domain admin approval" message, NOT a logged-in state.
 *      (No JWT is issued here — the account can't log in until approved.
 *      The login endpoint, built the same way, checks status === "active".)
 */
const register = asyncHandler(async (req, res) => {
  const { personalEmail, password, ...rest } = req.body;

  // 1. Duplicate check
  const alreadyExists = await userModel.emailExists(personalEmail);
  if (alreadyExists) {
    // Throwing an error with .statusCode is how we control the
    // HTTP status code that errorHandler.js eventually sends.
    const err = new Error('An account with this email already exists');
    err.statusCode = 409; // 409 Conflict
    throw err;
  }

  // 2. Hash the password — this is the ONLY place a password
  //    should ever be touched in plain text, and it happens
  //    immediately, before anything is stored.
  const passwordHash = await hashPassword(password);

  // 3. Create the record via the model (model handles the
  //    /users + /usersByEmail multi-path write internally)
  const { uid, rtfId } = await userModel.createUser({
  ...rest,
  personalEmail,
  passwordHash,
});

  // 4. Respond — 201 Created, consistent { success, data } shape
  res.status(201).json({
    success: true,
    data: {
      uid,
      rtfId,
      message: 'Registration received. Your domain admin will review your request.',
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { rtfId, password } = req.body;

  // Extract year from RTF ID
  // Example: SD27-T01@RTF -> 2027
  const yearMatch = rtfId.match(/^[A-Z]+(\d{2})-/);

  if (!yearMatch) {
    const err = new Error('Invalid RTF ID');
    err.statusCode = 401;
    throw err;
  }

  const yearOfPassing = `20${yearMatch[1]}`;

  // Find user using year + RTF ID
  const user = await userModel.getUserByRtfId(
    yearOfPassing,
    rtfId
  );

  // User doesn't exist
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  // Account must be active
  if (user.status !== 'active') {
    const err = new Error('Account pending approval');
    err.statusCode = 403;
    throw err;
  }

  // Check password
  const passwordMatches = await comparePassword(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  // Generate JWT
  const token = generateAccessToken({
    uid: user.uid,
    role: user.role,
    domain: user.domain,
  });

  // Never send passwordHash
  const { passwordHash, ...safeUser } = user;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: safeUser,
    },
  });
});
module.exports = {
  register,
  login,
};