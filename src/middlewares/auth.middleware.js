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
    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

module.exports = authMiddleware;
