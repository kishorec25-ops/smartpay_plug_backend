const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* ================= CONFIG ================= */

const CONFIG = {
  KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_SaUdD9E3AgCb2a",
  KEY_SECRET: process.env.RAZORPAY_SECRET || "SSOHyGDkLbJL15iAUp60dER9",
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "smartpay123",

  ESP_IP: "10.138.103.240",

  AMOUNT_DURATION_MAP: {
    10: 10,
    25: 30,
    50: 60
  }
};

/* ================= MIDDLEWARE ================= */

app.use(cors());

/* ================= DUPLICATE MEMORY ================= */

const processedPayments = new Set();

/* ================= WEBHOOK ================= */

app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
      console.log("🔐 WEBHOOK SECRET:", CONFIG.WEBHOOK_SECRET);

      const body = req.body;

      const expectedSignature = crypto
        .createHmac("sha256", CONFIG.WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      const receivedSignature = req.headers["x-razorpay-signature"];

      if (expectedSignature !== receivedSignature) {
        console.log("❌ Invalid signature");
        return res.status(400).send("Invalid signature");
      }

      console.log("✅ Signature verified");

      const data = JSON.parse(body.toString());

      if (data.event === "payment.captured") {
        const payment = data.payload.payment.entity;

        const amount = payment.amount / 100;
        const paymentId = payment.id;

        console.log("💰 Payment:", amount, "ID:", paymentId);

        /* 🔴 DUPLICATE CHECK */
        if (processedPayments.has(paymentId)) {
          console.log("⚠️ Duplicate payment ignored:", paymentId);
          return res.send("Duplicate");
        }

        /* ✅ MARK AS PROCESSED */
        processedPayments.add(paymentId);

        const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

        if (!duration) {
          console.log("⚠️ Unknown amount");
          return res.send("Ignored");
        }

        console.log("⏱ Duration:", duration);

        try {
          const url = `http://${CONFIG.ESP_IP}/relay?time=${duration}`;
          console.log("👉 ESP:", url);

          const response = await fetch(url);

          if (!response.ok) throw new Error("ESP failed");

          console.log("✅ ESP triggered");

        } catch (err) {
          console.log("❌ ESP ERROR:", err.message);
        }
      }

      res.send("OK");

    } catch (err) {
      console.log("❌ SERVER ERROR:", err.message);
      res.status(500).send("Error");
    }
  }
);

/* ================= JSON ================= */

app.use(express.json());

/* ================= CREATE ORDER ================= */

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    console.log("📥 Order request:", amount);

    const auth = Buffer.from(
      CONFIG.KEY_ID + ":" + CONFIG.KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt: "rcpt_" + Date.now()
      })
    });

    const data = await response.json();

    console.log("📦 Razorpay response:", data);

    res.json(data);

  } catch (err) {
    console.log("❌ ORDER ERROR:", err.message);
    res.status(500).send("Error");
  }
});

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.send("🚀 SmartPay Backend Running");
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});
