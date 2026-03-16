const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// Test route
app.get("/", (req, res) => {
  res.send("SmartPay backend running");
});

// Create payment order
app.post("/create-order", async (req, res) => {
  try {

    const amount = req.body.amount;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "order_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json(order);

  } catch (err) {
    res.status(500).send(err);
  }
});

// Verify payment
app.post("/verify-payment", (req, res) => {

  const { order_id, payment_id, signature } = req.body;

  const body = order_id + "|" + payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === signature) {
    res.json({ status: "success" });
  } else {
    res.json({ status: "failed" });
  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
