const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 24 * 60 * 60 * 1000,
};

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );
}

async function registerController(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      message: "Username, email, and password are required",
    });
  }

  const normalizedEmail = email.toLowerCase();

  const isUserExists = await userModel.findOne({ userEmail: normalizedEmail });

  if (isUserExists) {
    return res.status(409).json({
      message: "User Already Exists",
    });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await userModel.create({
    userName: username,
    userEmail: normalizedEmail,
    password: hash,
  });

  const token = createToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);

  res.status(201).json({
    message: "User Registered Successfully",
    user: {
      userName: user.userName,
      userEmail: user.userEmail,
    },
  });
}

async function loginController(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  const normalizedEmail = email.toLowerCase();

  const user = await userModel.findOne({ userEmail: normalizedEmail });

  if (!user) {
    return res.status(404).json({
      message: "User Doesn't Exists",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid Password",
    });
  }

  const token = createToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);

  res.status(200).json({
    message: "User LoggedIn Succesfully",
    user: {
      userName: user.userName,
      userEmail: normalizedEmail,
    },
  });
}

async function logoutController(req, res) {
  res.clearCookie("PTC_Token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(200).json({
    message: "User logged out successfully",
  });
}

async function meController(req, res) {
  res.status(200).json({
    user: {
      userName: req.user.userName,
      userEmail: req.user.userEmail,
    },
  });
}

module.exports = {
  registerController,
  loginController,
  logoutController,
  meController,
};
