const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");


const app = express();

app.use(cors());
app.use(express.json());

/* Razorpay setup */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

/* temporary storage */

let transactions = {};

/* test route */

app.get("/", (req, res) => {
  res.send("SmartPay Backend Running");
});

/* create order */

app.post("/create-order", async (req, res) => {

  try {

    const amount = req.body.amount;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "order_" + Date.now()
    });

    const transactionId = Date.now().toString();

    transactions[transactionId] = {
      orderId: order.id,
      amount: amount,
      paid: false
    };

    const upiLink =
      "upi://pay?pa=ajayajay1910206@oksbi&pn=SmartPayPlug&am=" +
      amount +
      "&cu=INR&tn=SmartPayPlug";

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

/* check payment status */

app.get("/check-payment-status", async (req, res) => {

  const transactionId = req.query.transactionId;
  const orderId = req.query.orderId;

  try {

    const payments = await razorpay.orders.fetchPayments(orderId);

    if (payments.items.length > 0) {

      const payment = payments.items[0];

      if (payment.status === "captured") {

        const txn = transactions[transactionId];

        if (txn) txn.paid = true;

        return res.json({
          success: true,
          paid: true,
          transaction: {
            id: transactionId,
            amount: txn.amount,
            port: 1,
            duration: 10
          }
        });

      }

    }

    res.json({
      success: true,
      paid: false
    });

  } catch (err) {

    res.json({
      success: false,
      error: err.message
    });

  }

});

/* webhook from Razorpay */

app.post("/razorpay-webhook", async (req, res) => {

  const event = req.body.event;

  if (event === "payment.captured") {

    const payment = req.body.payload.payment.entity;

    console.log("Payment captured:", payment.amount);

    /* trigger ESP32 */

    try {

      await fetch("http://172.25.16.135/unlock");

      console.log("ESP32 activated");

    } catch (err) {

      console.log("ESP32 error:", err);

    }

  }

  res.status(200).send("OK");

});

/* start server */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
