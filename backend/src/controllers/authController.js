import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import otpGenerator from "otp-generator";
import { sendMail } from "../config/mail.js";

/* TEMP OTP STORE */
const otpStore = {};
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const getOtpDeliveryMode = () =>
  (process.env.OTP_DELIVERY_MODE || "email").trim().toLowerCase();

const generateNumericOtp = () =>
  otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

const createOtpRecord = (email) => {
  const otp = generateNumericOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  otpStore[email] = {
    code: otp,
    expiresAt,
  };

  return { otp, expiresAt };
};

/* ================= SIGNUP ================= */
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    res.status(201).json({
      message: "Account created successfully",
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};


/* ================= LOGIN (SEND OTP) ================= */
export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    /* ROLE VALIDATION */
    if (user.role !== role) {
      return res.status(403).json({
        message: `You are registered as ${user.role}. Cannot login as ${role}`,
      });
    }

    /* GENERATE NUMERIC OTP */
    const { otp, expiresAt } = createOtpRecord(email);

    const otpDeliveryMode = getOtpDeliveryMode();

    if (otpDeliveryMode === "direct") {
      return res.json({
        message: "OTP generated successfully",
        email,
        expiresAt,
        expiresInSeconds: OTP_EXPIRY_MS / 1000,
        deliveryMode: "direct",
        directOtp: otp,
      });
    }

    /* SEND OTP EMAIL */
    await sendMail({
      to: email,
      subject: "HireMate Login OTP",
      text: `Your HireMate login OTP is ${otp}. It expires in 5 minutes.`,
    });

    res.json({
      message: "OTP sent to your email",
      email,
      expiresAt,
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
      deliveryMode: "email",
    });

  } catch (error) {
    console.error("Login error:", error);

    if (req.body?.email) {
      delete otpStore[req.body.email];
    }

    if (["EMAIL_NOT_CONFIGURED", "EMAIL_API_ERROR", "ESOCKET", "ECONNECTION", "ETIMEDOUT"].includes(error.code)) {
      return res.status(503).json({
        message:
          error.code === "EMAIL_NOT_CONFIGURED"
            ? error.message
            : "Unable to send OTP email right now. Please try again later.",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};


/* ================= VERIFY OTP ================= */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpRecord = otpStore[email];
    const normalizedOtp = String(otp || "").trim();

    if (!otpRecord) {
      return res.status(400).json({
        message: "Please request a new OTP",
      });
    }

    if (Date.now() > otpRecord.expiresAt) {
      delete otpStore[email];

      return res.status(400).json({
        message: "OTP expired. Please resend OTP.",
        otpExpired: true,
      });
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({
        message: "OTP must be a 6-digit number",
      });
    }

    if (otpRecord.code !== normalizedOtp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    /* DELETE OTP AFTER USE */
    delete otpStore[email];

    const user = await User.findOne({ email });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
      name: user.name,
    });

  } catch (error) {
    console.error("OTP verification error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};
