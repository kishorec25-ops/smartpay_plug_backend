const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

/* TEST ROUTE */
app.get("/", (req, res) => {
  res.send("🚀 SmartPay Backend Running");
});

/* ============================= */
/* 🔥 RAZORPAY WEBHOOK HANDLER */
/* ============================= */

app.post("/razorpay-webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    const signature = req.headers["x-razorpay-signature"];

    if (digest !== signature) {
      console.log("❌ Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;

      console.log("✅ Payment Received:", payment.amount / 100, "INR");

      /* ============================= */
      /* 🔌 TRIGGER ESP32 HERE */
      /* ============================= */

      try {
        // ⚠️ REPLACE WITH YOUR ESP32 PUBLIC URL
        await fetch("https://your-esp32-url/unlock");

        console.log("⚡ ESP32 TRIGGERED SUCCESSFULLY");
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
/* START SERVER */
/* ============================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
