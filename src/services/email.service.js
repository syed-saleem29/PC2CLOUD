const nodemailer = require("nodemailer");
const dns = require("dns");

function buildHtml(otp, action) {
  return `
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
  `;
}

async function sendViaResend(to, subject, html) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "PC2CLOUD <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(error.message);
}

async function sendViaSmtp(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  const from = process.env.EMAIL_FROM || `PC2CLOUD <${process.env.EMAIL_USER}>`;
  await transporter.sendMail({ from, to, subject, html });
}

async function sendOtpEmail(to, otp, type) {
  const isVerify = type === "verify";
  const subject = isVerify ? "Verify your PC2CLOUD email" : "Reset your PC2CLOUD password";
  const action = isVerify ? "verify your email address" : "reset your password";
  const html = buildHtml(otp, action);

  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, subject, html);
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return sendViaSmtp(to, subject, html);
  }

  throw new Error("Email service not configured. Set RESEND_API_KEY or EMAIL_USER/EMAIL_PASS.");
}

module.exports = { sendOtpEmail };
