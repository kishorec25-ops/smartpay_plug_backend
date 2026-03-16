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

let transactions = {};

app.get("/", (req, res) => {
  res.send("SmartPay Backend Running");
});

app.post("/create-order", async (req, res) => {

  try {

    const amount = req.body.amount;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    const transactionId = Date.now().toString();

    transactions[transactionId] = {
      orderId: order.id,
      amount: amount,
      paid: false
    };

    const upiLink =
      "upi://pay?pa=kishorak142007@okicici&pn=SmartPayPlug&am=" +
      amount +
      "&cu=INR&tn=SmartPay";

    res.json({
      success: true,
      order: { orderId: order.id },
      transaction: { id: transactionId },
      paymentLink: { upiLink: upiLink }
    });

  } catch (err) {

    res.json({
      success: false,
      error: err.message
    });

  }

});

app.get("/check-payment-status", (req, res) => {

  const transactionId = req.query.transactionId;

  const txn = transactions[transactionId];

  if (!txn) {
    return res.json({
      success: false,
      paid: false
    });
  }

  res.json({
    success: true,
    paid: false,
    transaction: {
      id: transactionId,
      amount: txn.amount,
      port: 1,
      duration: 10
    }
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
