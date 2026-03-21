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
/* PREVENT DUPLICATE PAYMENTS */
/* ============================= */

const processedPayments = new Set();

/* ============================= */
/* 🔥 RAZORPAY WEBHOOK */
/* ============================= */

app.post("/razorpay-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  try {
    const secret = "smartpay123";

    const body = req.body;

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
      const paymentId = payment.id;

      console.log("💰 PAYMENT SUCCESS:", amount, "INR");

      /* 🔒 PREVENT DUPLICATE */
      if (processedPayments.has(paymentId)) {
        console.log("⚠️ Duplicate payment ignored");
        return res.status(200).send("Duplicate");
      }

      processedPayments.add(paymentId);

      /* ============================= */
      /* 🔌 TIME-BASED RELAY LOGIC */
      /* ============================= */

      try {
        let duration = 0;

        if (amount === 10) duration = 10;
        else if (amount === 25) duration = 30;
        else if (amount === 50) duration = 60;

        if (duration > 0) {
          const url = `http://10.187.207.135/relay?time=${duration}`;

          console.log("👉 Calling ESP:", url);

          const response = await fetch(url);

          console.log("ESP Response Status:", response.status);
          console.log(`⚡ ESP32 TRIGGERED for ${duration} seconds`);
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
