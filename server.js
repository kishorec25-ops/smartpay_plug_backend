const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* CONFIG */
const CONFIG = {
  ESP_IP: "10.138.103.240",
  WEBHOOK_SECRET: "smartpay123",

  AMOUNT_DURATION_MAP: {
    10: 10,
    25: 30,
    50: 60
  }
};

app.use(cors());

/* IMPORTANT: RAW for webhook */
app.use("/razorpay-webhook", express.raw({ type: "application/json" }));
app.use(express.json());

/* TEMP STORAGE */
const orders = new Map();
const processedPayments = new Set();

/* ================= CREATE ORDER ================= */

app.post("/create-order", (req, res) => {
  const { amount, email } = req.body;

  const orderId = "order_" + Date.now();

  orders.set(orderId, {
    amount,
    email
  });

  console.log("🧾 Order created:", orderId, amount, email);

  res.json({
    orderId,
    amount
  });
});

/* ================= WEBHOOK ================= */

app.post("/razorpay-webhook", async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  try {
    const body = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", CONFIG.WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    const receivedSignature = req.headers["x-razorpay-signature"];

    if (expectedSignature !== receivedSignature) {
      console.log("❌ Invalid signature");
      return res.status(400).send("Invalid");
    }

    const data = JSON.parse(body.toString());

    if (data.event === "payment.captured") {
      const payment = data.payload.payment.entity;

      const amount = payment.amount / 100;
      const paymentId = payment.id;

      if (processedPayments.has(paymentId)) {
        return res.send("Duplicate");
      }

      processedPayments.add(paymentId);

      console.log("💰 Payment:", amount);

      const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

      /* ESP */
      try {
        await fetch(`http://${CONFIG.ESP_IP}/relay?time=${duration}`);
        console.log("⚡ ESP triggered");
      } catch (err) {
        console.log("❌ ESP error:", err.message);
      }
    }

    res.send("OK");

  } catch (err) {
    console.log("❌ ERROR:", err.message);
    res.status(500).send("Error");
  }
});

/* ================= START ================= */

app.listen(3000, () => console.log("🔥 Backend running"));
