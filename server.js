const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

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

const processedPayments = new Set();

app.post("/razorpay-webhook", express.raw({ type: "application/json" }), async (req, res) => {
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

    console.log("✅ Signature verified");

    const data = JSON.parse(body.toString());

    if (data.event === "payment.captured") {
      const payment = data.payload.payment.entity;
      const amount = payment.amount / 100;
      const paymentId = payment.id;

      console.log("💰 PAYMENT:", amount);

      if (processedPayments.has(paymentId)) {
        console.log("⚠️ Duplicate");
        return res.send("Duplicate");
      }

      processedPayments.add(paymentId);

      const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

      if (!duration) {
        console.log("⚠️ Unknown amount");
        return res.send("Ignored");
      }

      console.log("⏱ Duration:", duration);

      try {
        const url = "http://" + CONFIG.ESP_IP + "/relay?time=" + duration;
        console.log("👉 ESP:", url);

        await fetch(url);

      } catch (err) {
        console.log("❌ ESP ERROR:", err.message);
      }
    }

    res.send("OK");

  } catch (err) {
    console.log("❌ ERROR:", err.message);
    res.status(500).send("Error");
  }
});

app.get("/", (req, res) => {
  res.send("🚀 SmartPay Backend Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Running on " + PORT);
});
