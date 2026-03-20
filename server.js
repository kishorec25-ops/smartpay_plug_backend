const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

/* ============================= */
/* MIDDLEWARE */
/* ============================= */

app.use(cors());

/* ============================= */
/* 🔥 RAZORPAY WEBHOOK (FIRST) */
/* ============================= */

app.post("/razorpay-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  try {
    const secret = "smartpay123";

    const body = req.body; // RAW buffer

    const expectedSignature = crypto
      .createHmac("sha256", secret)
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

      console.log("💰 PAYMENT SUCCESS:", amount, "INR");

      /* ============================= */
      /* 🔌 ESP32 TRIGGER LOGIC */
/* ============================= */

try {
  let url = "";

  if (amount === 10) {
    url = "https://172.25.16.135/relay1";
  } else if (amount === 25) {
    url = "https://172.25.16.135/relay2";
  } else if (amount === 50) {
    url = "https://172.25.16.135/relay3";
  }

  if (url) {
    await fetch(url);
    console.log("⚡ ESP32 TRIGGERED:", url);
  } else {
    console.log("⚠️ Unknown payment amount:", amount);
  }

} catch (err) {
  console.log("❌ ESP32 ERROR:", err.message);
}

    }

    res.status(200).send("OK");

  } catch (err) {
    console.log("❌ WEBHOOK ERROR:", err.message);
    res.status(500).send("Server Error");
  }
});

/* ============================= */
/* JSON MIDDLEWARE (AFTER WEBHOOK) */
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
