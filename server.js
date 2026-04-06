const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* ================= CONFIG ================= */

const CONFIG = {
  ESP_IP: "10.138.103.240", // change if needed
  WEBHOOK_SECRET: "smartpay123",

  AMOUNT_DURATION_MAP: {
    10: 10,
    25: 30,
    50: 60
  }
};

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());

/* ================= MEMORY ================= */

const processedPayments = new Set();

/* ================= WEBHOOK ================= */

app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
      const body = req.body;

      /* ===== SIGNATURE VERIFY ===== */
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

      /* ===== PAYMENT EVENT ===== */
      if (data.event === "payment.captured") {
        const payment = data.payload.payment.entity;

        const amount = payment.amount / 100;
        const paymentId = payment.id;

        console.log("💰 Payment received:", amount, "ID:", paymentId);

        /* ===== DUPLICATE CHECK ===== */
        if (processedPayments.has(paymentId)) {
          console.log("⚠️ Duplicate payment ignored");
          return res.send("Duplicate");
        }

        processedPayments.add(paymentId);

        /* ===== MAP TO DURATION ===== */
        const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

        if (!duration) {
          console.log("⚠️ Unknown amount:", amount);
          return res.send("Ignored");
        }

        console.log("⏱ Power duration:", duration, "seconds");

        /* ===== ESP CONTROL ===== */
        try {
          const url = `http://${CONFIG.ESP_IP}/relay?time=${duration}`;
          console.log("👉 Sending to ESP:", url);

          // Node 18+ has fetch built-in
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error("ESP not responding");
          }

          console.log("✅ ESP triggered successfully");

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

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.send("🚀 SmartPay Backend Running");
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
