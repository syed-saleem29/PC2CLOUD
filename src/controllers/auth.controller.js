const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function registerController(req, res) {
  const { username, email, password } = req.body;
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

  const token = jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );
  res.cookie("PTC_Token", token);

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

  const token = jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.cookie("PTC_Token", token);

  res.status(200).json({
    message: "User LoggedIn Succesfully",
    user: {
      userEmail: normalizedEmail,
    },
  });
}

module.exports = {
  registerController,
  loginController,
};
