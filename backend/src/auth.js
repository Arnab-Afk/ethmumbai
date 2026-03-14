/**
 * src/auth.js
 * JWT-based auth helpers used by both GitHub and Google OAuth flows.
 *
 * Every logged-in user gets a signed JWT that encodes:
 *   { sub, provider, login/email, name, avatar, githubToken? }
 *
 * The JWT is returned to the frontend and sent as:
 *   Authorization: Bearer <token>
 * or as a query param:   ?token=<token>
 */

const jwt  = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET  = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

/** Sign a user payload → JWT string */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** Verify a JWT → decoded payload, or null if invalid */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Express middleware — extracts and verifies JWT from:
 *   Authorization: Bearer <token>
 *   Query param:   ?token=<token>
 *
 * Attaches req.user if valid, or returns 401.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ")
    ? header.slice(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required — send Authorization: Bearer <token>" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = decoded;
  next();
}

module.exports = { signToken, verifyToken, requireAuth };
