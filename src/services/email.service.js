const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(to, otp, type) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email service not configured. Set EMAIL_USER and EMAIL_PASS.");
  }
  const isVerify = type === "verify";
  const subject = isVerify ? "Verify your PC2CLOUD email" : "Reset your PC2CLOUD password";
  const action = isVerify ? "verify your email address" : "reset your password";

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `PC2CLOUD <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="margin-bottom:24px">
          <span style="font-size:18px;font-weight:700">PC2CLOUD</span>
          <span style="color:#6b7280;font-size:14px;margin-left:8px">Private cloud storage</span>
        </div>
        <p style="margin:0 0 8px;font-size:15px">Use the code below to <strong>${action}</strong>.</p>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f3f4f6;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
          <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#111">${otp}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
