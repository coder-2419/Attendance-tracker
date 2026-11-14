const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Set your private shared secret phrase
const WEBHOOK_SECRET = "MY_SUPER_SECRET_KEY_8073";

exports.autoVerifyUpiWebhook = functions.https.onRequest(async (req, res) => {
  // 1. Authorization check
  const incomingSecret = req.headers["x-webhook-secret"] || (req.body && req.body.secret);
  if (incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).send("Unauthorized request");
  }

  const rawMessage = req.body.messageText || "";

  // 2. Extract Order Code (matches AT followed by 4 digits, e.g., AT4821 or AT-4821)
  const orderMatch = rawMessage.match(/AT-?(\d{4})/i);
  // Extract amount paid (matches Rs. 20, INR 20, or ₹20)
  const amountMatch = rawMessage.match(/(?:Rs\.?|INR|\u20B9)\s*([\d.]+)/i);

  if (!orderMatch) {
    return res.status(200).send("No order code found in email body.");
  }

  const orderId = "AT" + orderMatch[1];
  const paidAmount = amountMatch ? parseFloat(amountMatch[1]) : 20;

  try {
    const orderRef = db.collection("payment_orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(200).send(`Order ${orderId} not found in database.`);
    }

    const orderData = orderDoc.data();

    // Prevent underpayment attacks (e.g. paying ₹1 with the note)
    if (paidAmount < (orderData.amount || 20)) {
      await orderRef.update({
        status: "flagged_underpaid",
        receivedAmount: paidAmount,
        flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).send("Underpaid transaction flagged.");
    }

    // 3. Mark order as approved
    await orderRef.update({
      status: "approved",
      receivedAmount: paidAmount,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Unlock student's account
    await db.collection("users").doc(orderData.uid).set({
      isPro: true,
      role: "pro",
      unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).send(`Order ${orderId} verified and student unlocked!`);
  } catch (err) {
    console.error("Auto-verification error:", err);
    return res.status(500).send("Internal server error");
  }
});