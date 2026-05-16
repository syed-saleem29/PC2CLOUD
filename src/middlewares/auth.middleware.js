const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const token = req.cookies.PTC_Token || bearerToken;

    if (!token) {
      console.log(`[auth] 401 no-token  path=${req.path}  hasCookie=${!!req.cookies.PTC_Token}  hasBearer=${!!bearerToken}  origin=${req.headers.origin}`);
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(payload.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid authentication token",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(`[auth] 401 error  path=${req.path}  msg=${error.message}  origin=${req.headers.origin}`);
    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

module.exports = authMiddleware;
