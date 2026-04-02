// index.js - পরিষ্কার version

const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./db");
require("dotenv").config();

const app = express();

// ── Middlewares ──────────────────────────────────────
app.use(cookieParser());
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://zeroomiro26.web.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: { action: "deny" },
  xssFilter: true,
}));

app.use(cors({
  origin: ["https://zeroomiro26.web.app", "http://localhost:5173"],
  credentials: true,
}));

// ── Collections ──────────────────────────────────────
let productCollection;
let cartCollection;
let wishListCollection;
let orderCollection;
let confirmOrderCollection;
let orderCancelCollection;
let notificationCollection;
let campaignCollection;
let contactMessageCollection;
let isConnected = false;

// ── DB Init ──────────────────────────────────────────
async function initCollections() {
  if (isConnected) return; // ✅ already connected হলে skip

  const db = await connectDB();

  productCollection        = db.collection("allProducts");
  cartCollection           = db.collection("cartData");
  wishListCollection       = db.collection("wishListData");
  orderCollection          = db.collection("UserOrderStore");
  confirmOrderCollection   = db.collection("ConfirmOrderList");
  orderCancelCollection    = db.collection("orderCancel");
  notificationCollection   = db.collection("notificationCollection");
  campaignCollection       = db.collection("campaign");
  contactMessageCollection = db.collection("contactMessages");

  isConnected = true;
  console.log("✅ DB Collections ready");
}

// ✅ সব request এর আগে DB check
app.use(async (req, res, next) => {
  try {
    await initCollections();
    next();
  } catch (err) {
    console.error("DB init failed:", err.message);
    res.status(500).send({ message: "Database connection failed" });
  }
});

// ── verifyToken ──────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized access" });

  jwt.verify(token, process.env.JWT_ACCESS, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized access" });
    req.decoded = decoded;
    next();
  });
};

// ── Routes ───────────────────────────────────────────

app.get("/", (req, res) => res.send("Backend is running 🚀"));

// JWT
app.post("/jwt", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ message: "Email required" });

  const accessToken = jwt.sign({ email }, process.env.JWT_ACCESS, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.send({ success: true, accessToken });
});

// Contact
app.post("/contact-message", async (req, res) => {
  try {
    const messageData = req.body;
    if (!messageData.name || !messageData.email || !messageData.subject || !messageData.message) {
      return res.status(400).send({ success: false, message: "All required fields must be provided" });
    }
    const result = await contactMessageCollection.insertOne({ ...messageData, createdAt: new Date() });
    res.send({ success: true, message: "Message sent successfully", insertedId: result.insertedId });
  } catch {
    res.status(500).send({ success: false, message: "Failed to send message" });
  }
});

// Products
app.get("/allProducts", async (req, res) => {
  const result = await productCollection.find().toArray();
  res.send(result);
});

app.get("/allData", async (req, res) => {
  try {
    const { category, subCategory } = req.query;
    let query = {};
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    const result = await productCollection.find(query).toArray();
    res.send(result);
  } catch {
    res.status(500).send({ error: "Server error" });
  }
});

app.get("/allProduct/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const result = await productCollection.findOne(query);
  if (!result) return res.status(404).send({ message: "Product not found" });
  res.send(result);
});

app.post("/productAdd", async (req, res) => {
  const result = await productCollection.insertOne(req.body);
  res.send(result);
});

app.delete("/allProduct/:id", async (req, res) => {
  const result = await productCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

// Wishlist
app.get("/wishListGet", async (req, res) => {
  res.send(await wishListCollection.find().toArray());
});

app.post("/addWishList", async (req, res) => {
  res.send(await wishListCollection.insertOne(req.body));
});

app.delete("/wishListDelete/:id", verifyToken, async (req, res) => {
  res.send(await wishListCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
});

// Notifications
app.get("/notifications", verifyToken, async (req, res) => {
  res.send(await notificationCollection.find().sort({ createdAt: -1 }).toArray());
});

app.get("/notifications/unread-count", verifyToken, async (req, res) => {
  const count = await notificationCollection.countDocuments({ isRead: false });
  res.send({ count });
});

app.patch("/notifications/read-all", verifyToken, async (req, res) => {
  await notificationCollection.updateMany({ isRead: false }, { $set: { isRead: true } });
  res.send({ success: true });
});

// Orders
app.get("/admin/orders", async (req, res) => {
  const { filter, startDate, endDate } = req.query;
  let query = {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (filter === "today") query.createdAt = { $gte: startOfToday };
  else if (filter === "yesterday") query.createdAt = { $gte: startOfYesterday, $lt: startOfToday };
  else if (filter === "thisMonth") query.createdAt = { $gte: startOfMonth };
  else if (filter === "custom" && startDate && endDate) {
    query.newDate = { $gte: new Date(startDate).toISOString(), $lte: new Date(endDate).toISOString() };
  }

  res.send(await orderCollection.find(query).sort({ createdAt: -1 }).toArray());
});

app.get("/orderConfirm", verifyToken, async (req, res) => {
  res.send(await confirmOrderCollection.find().toArray());
});

app.post("/orders", async (req, res) => {
  const userOrderInfo = { ...req.body, createdAt: new Date() };
  const result = await orderCollection.insertOne(userOrderInfo);

  await notificationCollection.insertOne({
    type: "order",
    orderId: result.insertedId,
    message: "New order received",
    isRead: false,
    createdAt: new Date(),
  });

  res.send(result);
});

app.post("/orderConfirm/:id", verifyToken, async (req, res) => {
  res.send(await confirmOrderCollection.insertOne({ _id: new ObjectId(req.params.id) }));
});

app.patch("/updateOrderStatus/:id", verifyToken, async (req, res) => {
  res.send(await confirmOrderCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { orderStatus: "delivered", deliveredAt: new Date() } }
  ));
});

app.delete("/orderDelete/:id", verifyToken, async (req, res) => {
  res.send(await orderCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
});

// Order Cancel
app.get("/orderCancelList", verifyToken, async (req, res) => {
  res.send(await orderCancelCollection.find().toArray());
});

app.post("/orderCancel", verifyToken, async (req, res) => {
  res.send(await orderCancelCollection.insertOne(req.body));
});

app.delete("/deleteOrderCancel/:id", verifyToken, async (req, res) => {
  res.send(await orderCancelCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
});

// Cart
app.get("/cartData", async (req, res) => {
  res.send(await cartCollection.find({ userId: req.query.userId }).toArray());
});

app.post("/cartData", async (req, res) => {
  res.send(await cartCollection.insertOne(req.body));
});

app.patch("/cartData/:id", async (req, res) => {
  res.send(await cartCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { quantity: req.body.quantity } }
  ));
});

app.patch("/cart/dataIncrement/:id", async (req, res) => {
  const cartItem = await cartCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!cartItem) return res.status(404).send({ message: "Cart item not found" });
  res.send(await cartCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { quantity: 1 } }));
});

app.patch("/cart/dataDecrement/:id", async (req, res) => {
  const cartItem = await cartCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!cartItem) return res.status(404).send({ message: "Cart item not found" });
  if (cartItem.quantity <= 1) return res.status(400).send({ message: "Minimum quantity is 1" });
  res.send(await cartCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { quantity: -1 } }));
});

app.delete("/cartDelete/:id", async (req, res) => {
  res.send(await cartCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
});

app.delete("/cartDeleteAll", async (req, res) => {
  res.send(await cartCollection.deleteMany({}));
});

// Campaign
app.get("/allCampaign", async (req, res) => {
  res.send(await campaignCollection.find().toArray());
});

app.get("/campaign", async (req, res) => {
  const now = Date.now();
  const campaign = await campaignCollection.findOne({
    startTime: { $lte: now },
    endTime: { $gte: now },
    isActive: true,
  });
  res.send(campaign || {});
});

app.patch("/campaign/:id", async (req, res) => {
  res.send(await campaignCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { isActive: req.body.isActive } }
  ));
});

app.post("/campaign", async (req, res) => {
  try {
    const { title, startTime, endTime } = req.body;
    const result = await campaignCollection.insertOne({
      title,
      startTime: parseInt(startTime),
      endTime: parseInt(endTime),
      isActive: true,
      createdAt: new Date(),
    });
    res.send(result);
  } catch {
    res.status(500).send({ error: "Failed to create campaign" });
  }
});

// Merge Cart
app.post("/merge-cart", async (req, res) => {
  const { guestId, userEmail } = req.body;
  const guestCart = await cartCollection.find({ userId: guestId }).toArray();

  for (const item of guestCart) {
    const exists = await cartCollection.findOne({ userId: userEmail, productId: item.productId });
    if (exists) {
      await cartCollection.updateOne({ _id: exists._id }, { $inc: { quantity: item.quantity } });
    } else {
      await cartCollection.insertOne({ ...item, userId: userEmail });
    }
  }

  await cartCollection.deleteMany({ userId: guestId });
  res.send({ success: true });
});

module.exports = app;