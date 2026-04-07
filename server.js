const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/* ================= CONFIG ================= */

const CONFIG = {
  KEY_ID: "rzp_test_SaUdD9E3AgCb2a",

  // 🔴 PUT YOUR RAZORPAY SECRET HERE
  KEY_SECRET: "SSOHyGDkLbJL15iAUp60dER9",

  // 🔴 SAME SECRET YOU SET IN RAZORPAY WEBHOOK
  WEBHOOK_SECRET: "smartpay123",

  // 🔴 YOUR ESP DEVICE IP
  ESP_IP: "10.138.103.240",

  AMOUNT_DURATION_MAP: {
    10: 10,
    25: 30,
    50: 60
  }
};

/* ================= MIDDLEWARE ================= */

app.use(cors());

/* ================= WEBHOOK (VERY IMPORTANT FIRST) ================= */

app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }), // ✅ MUST BE RAW
  async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
      const body = req.body; // Buffer

      /* ===== VERIFY SIGNATURE ===== */
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

      /* ===== HANDLE PAYMENT ===== */
      if (data.event === "payment.captured") {

        const payment = data.payload.payment.entity;

        const amount = payment.amount / 100;
        const paymentId = payment.id;

        console.log("💰 Payment received:", amount);
        console.log("🆔 Payment ID:", paymentId);

        const duration = CONFIG.AMOUNT_DURATION_MAP[amount];

        if (!duration) {
          console.log("⚠️ Unknown amount");
          return res.send("Ignored");
        }

        console.log("⏱ Duration:", duration, "seconds");

        /* ===== ESP CONTROL ===== */
        try {
          const url = `http://${CONFIG.ESP_IP}/relay?time=${duration}`;
          console.log("👉 Sending to ESP:", url);

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

/* ================= JSON (AFTER WEBHOOK) ================= */

app.use(express.json());

/* ================= CREATE ORDER ================= */

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const orderData = {
      amount: amount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now()
    };

    const auth = Buffer.from(
      CONFIG.KEY_ID + ":" + CONFIG.KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();

    console.log("🧾 Order created:", data.id);

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

app.listen(3000, () => {
  console.log("🔥 Server running on http://localhost:3000");
});
