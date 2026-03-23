const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

/* ============================= */
/* 🔧 CONFIG */
/* ============================= */

const CONFIG = {
  ESP_IP: "10.184.181.138",   // ✅ YOUR ESP IP
  WEBHOOK_SECRET: "smartpay123",

  AMOUNT_DURATION_MAP: {
    10: 10,   // ₹10 → 10 sec
    25: 30,   // ₹25 → 30 sec
    50: 60    // ₹50 → 60 sec
  }
};

/* ============================= */
/* MIDDLEWARE */
/* ============================= */

app.use(cors());

/* ============================= */
/* PREVENT DUPLICATE PAYMENTS */
/* ============================= */

const processedPayments = new Set();

/* ============================= */
/* 🔥 RAZORPAY WEBHOOK */
/* ============================= */

app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
      const body = req.body;

      /* 🔐 VERIFY SIGNATURE */
      const expectedSignature = crypto
        .createHmac("sha256", CONFIG.WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      const receivedSignature = req.headers["x-razorpay-signature"];

      if (expectedSignature !== receivedSignature) {
        console.log("❌ Invalid webhook signature");
        return res.status(400).send("Invalid signature");
      }

      console.log("✅ Signature verified");

      const data = JSON.parse(body.toString());
      const event = data.event;

      console.log("👉 Event:", event);

      if (event === "payment.captured") {
        const payment = data.payload.payment.entity;
        const amount = payment.amount / 100;
        const paymentId = payment.id;

        console.log("💰 PAYMENT SUCCESS:", amount, "INR");

        /* 🔒 PREVENT DUPLICATE */
        if (processedPayments.has(paymentId)) {
          console.log("⚠️ Duplicate payment ignored");
          return res.status(200).send("Duplicate");
        }

        processedPayments.add(paymentId);

        /* 🔌 MAP AMOUNT → TIME */
        const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

        if (!duration) {
          console.log("⚠️ Unknown payment amount:", amount);
          return res.status(200).send("Ignored");
        }

        console.log("🧠 Duration selected:", duration, "seconds");

        /* 🔌 CALL ESP32 */
        try {
          const url = `http://${CONFIG.ESP_IP}/relay?time=${duration}`;
          console.log("👉 Calling ESP:", url);

          const response = await fetch(url, { timeout: 5000 });

          if (response.status === 200) {
            console.log(`⚡ Relay ON for ${duration} seconds`);
          } else {
            console.log("⚠️ ESP responded with status:", response.status);
          }

        } catch (err) {
          console.log("❌ ESP ERROR:", err.message);
        }
      }

      res.status(200).send("OK");

    } catch (err) {
      console.log("❌ WEBHOOK ERROR:", err.message);
      res.status(500).send("Server Error");
    }
  }
);

/* ============================= */
/* JSON MIDDLEWARE */
/* ============================= */

app.use(express.json());

/* ============================= */
/* TEST ROUTE */
/* ============================= */

app.get("/", (req, res) => {
  res.send("🚀 SmartPay Backend Running");
});

/* ============================= */
/* START SERVER */
/* ============================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
