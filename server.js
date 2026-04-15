require("dotenv").config();
const express   = require("express");
const nodemailer = require("nodemailer");
const rateLimit  = require("express-rate-limit");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rate limit: max 3 contact submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many messages from your connection. Please try again later." },
});

// Serve the website HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "planned-durability_21.html"));
});

// Contact form endpoint
app.post("/contact", contactLimiter, async (req, res) => {
  const { name, email, phone, message, _trap } = req.body;

  // Honeypot: bots fill in hidden fields, humans don't
  if (_trap) {
    return res.json({ ok: true }); // silently discard
  }

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email address." });
  }

  // Limit field lengths to prevent abuse
  if (name.length > 100 || email.length > 200 || message.length > 3000) {
    return res.status(400).json({ ok: false, error: "Input too long." });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const body = [
    `Name:    ${name}`,
    `Email:   ${email}`,
    phone ? `Phone:   ${phone}` : null,
    ``,
    `Message:`,
    message,
  ].filter(l => l !== null).join("\n");

  try {
    await transporter.sendMail({
      from:    `"Planned Durability Website" <${process.env.GMAIL_USER}>`,
      to:      process.env.REPORT_TO || process.env.GMAIL_USER,
      replyTo: email,
      subject: `New enquiry — Planned Durability`,
      text:    body,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[contact] Mail error:", err.message);
    res.status(500).json({ ok: false, error: "Failed to send. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Planned Durability site running at http://localhost:${PORT}`);
});
