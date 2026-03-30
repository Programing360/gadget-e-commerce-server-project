const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
// middlewares
app.use(cookieParser());
app.use(express.json());
// "https://zeroomiro26.web.app",
// "http://localhost:5173"
app.use(
  cors({
    origin: ["https://zeroomiro26.web.app", "http://localhost:5173"],
    credentials: true,
  }),
);
{
  /* RGm7scBdFkBLHQnw */
}
const uri = `mongodb+srv://${process.env.DB_GEROMIROO}:${process.env.DB_PASS}@cluster0.3036qk8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const database = client.db("zeroomiro");
  const productCollection = database.collection("allProducts");
  const cartCollection = database.collection("cartData");
  const wishListCollection = database.collection("wishListData");
  const orderCollection = database.collection("UserOrderStore");
  const confirmOrderCollection = database.collection("ConfirmOrderList");
  const orderCancelCollection = database.collection("orderCancel");
  const notificationCollection = database.collection("notificationCollection");
  const campaignCollection = database.collection("campaign");

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // JWT token verification middleware
    // Inside your existing code, just after jwt route
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email required" });
      }

      const user = { email };

      // access token 15 min
      const accessToken = jwt.sign(user, process.env.JWT_ACCESS, {
        expiresIn: "15m",
      });

      // refresh token 7 days
      const refreshToken = jwt.sign(user, process.env.JWT_EXPIRES_IN, {
        expiresIn: "7d",
      });

      // 🍪 store refresh token in httpOnly cookie
      res
        .cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true, // true in production
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .send({ success: true, accessToken });
    });

    app.post("/refresh-token", async (req, res) => {
      const token = req.cookies?.refreshToken;

      if (!token) return res.status(401).send({ message: "No refresh token" });

      jwt.verify(token, process.env.JWT_REFRESH, (err, decoded) => {
        if (err)
          return res.status(403).send({ message: "Invalid refresh token" });

        const user = { email: decoded.email };

        // generate new access token
        const newAccessToken = jwt.sign(user, process.env.JWT_ACCESS, {
          expiresIn: "15m",
        });

        res.send({ accessToken: newAccessToken });
      });
    });

    const verifyToken = (req, res, next) => {
      const token =
        req.cookies?.token || req.headers.authorization?.split(" ")[1];
      if (!token)
        return res.status(401).send({ message: "Unauthorized access" });

      jwt.verify(token, process.env.JWT_ACCESS, (err, decoded) => {
        if (err)
          return res.status(401).send({ message: "Unauthorized access" });

        req.decoded = decoded;
        next();
      });
    };

    app.get("/allProducts", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/allData", async (req, res) => {
      try {
        const { category, subCategory } = req.query; // query থেকে subCategory নেওয়া

        let query = {};

        if (category) query.category = category;
        if (subCategory) query.subCategory = subCategory; // subCategory filter

        const result = await productCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Server error" });
      }
    });

    app.get("/allProduct/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      if (!result) {
        return res.status(404).send({ message: "Product not found" });
      }
      res.send(result);
    });

    app.post("/productAdd", async (req, res) => {
      const data = req.body;
      const result = await productCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/allProduct/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    // add and get Wish list cart section--------

    app.get("/wishListGet", async (req, res) => {
      const result = await wishListCollection.find().toArray();
      res.send(result);
    });

    app.post("/addWishList", async (req, res) => {
      const wishListData = req.body;
      const result = await wishListCollection.insertOne(wishListData);
      res.send(result);
    });

    app.delete("/wishListDelete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await wishListCollection.deleteOne(query);
      res.send(result);
    });

    // notification
    app.get("/notifications", verifyToken, async (req, res) => {
      const notifications = await notificationCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.send(notifications);
    });

    app.get("/notifications/unread-count", verifyToken, async (req, res) => {
      const count = await notificationCollection.countDocuments({
        isRead: false,
      });

      res.send({ count });
    });

    app.patch("/notifications/read-all", verifyToken, async (req, res) => {
      await notificationCollection.updateMany(
        { isRead: false },
        { $set: { isRead: true } },
      );

      res.send({ success: true });
    });

    // order cart-----

    // Get orders with optional time filter
    app.get("/admin/orders", verifyToken, async (req, res) => {
      const { filter, startDate, endDate } = req.query;

      let query = {};

      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (filter === "today") {
        query.createdAt = { $gte: startOfToday };
      } else if (filter === "yesterday") {
        query.createdAt = { $gte: startOfYesterday, $lt: startOfToday };
      } else if (filter === "thisMonth") {
        query.createdAt = { $gte: startOfMonth };
      } // 🔥 custom range
      else if (filter === "custom" && startDate && endDate) {
        query.newDate = {
          $gte: new Date(startDate).toISOString(),
          $lte: new Date(endDate).toISOString(),
        };
      }

      const result = await orderCollection
        .find(query)
        .sort({ createdAt: -1 }) // ✅ latest first
        .toArray();

      res.send(result);
    });

    app.get("/orderConfirm", verifyToken, async (req, res) => {
      const result = await confirmOrderCollection.find().toArray();
      res.send(result);
    });

    app.post("/orders", async (req, res) => {
      const userOrderInfo = req.body;

      userOrderInfo.createdAt = new Date();
      let result = await orderCollection.insertOne(userOrderInfo);
      // 🔔 notification create

      try {
        await notificationCollection.insertOne({
          type: "order",
          orderId: result.insertedId, // ✅ correct
          message: "New order received",
          isRead: false,
          createdAt: new Date(),
        });
      } catch (error) {
        if (error) {
          alert(error.message);
        }
      }

      res.send(result);
    });

    app.post("/orderConfirm/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await confirmOrderCollection.insertOne(query);
      res.send(result);
    });

    app.patch("/updateOrderStatus/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          orderStatus: "delivered",
          deliveredAt: new Date(),
        },
      };

      const result = await confirmOrderCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    app.delete("/orderDelete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // order cancel---------------
    app.get("/orderCancelList", verifyToken, async (req, res) => {
      const result = await orderCancelCollection.find().toArray();
      res.send(result);
    });
    app.post("/orderCancel", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await orderCancelCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/deleteOrderCancel/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCancelCollection.deleteOne(query);
      res.send(result);
    });

    // cart data receive-----------

    app.get("/cartData", async (req, res) => {
      const userId = req.query.userId;

      const result = await cartCollection.find({ userId: userId }).toArray();

      res.send(result);
    });

    app.post("/cartData", async (req, res) => {
      const cartData = req.body;
      const result = await cartCollection.insertOne(cartData);
      res.send(result);
    });

    app.patch("/cartData/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedCart = req.body;
      const update = {
        $set: {
          quantity: updatedCart.quantity,
        },
      };
      const result = await cartCollection.updateOne(filter, update);
      res.send(result);
    });
    // cart quantity increment
    app.patch("/cart/dataIncrement/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // get current cart item
      const cartItem = await cartCollection.findOne(filter);

      if (!cartItem) {
        return res.status(404).send({ message: "Cart item not found" });
      }

      const update = {
        $inc: { quantity: 1 },
      };

      const result = await cartCollection.updateOne(filter, update);
      res.send(result);
    });
    // cart quantity decrement
    app.patch("/cart/dataDecrement/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      // get current cart item
      const cartItem = await cartCollection.findOne(filter);
      if (!cartItem) {
        return res.status(404).send({ message: "Cart item not found" });
      }

      if (cartItem.quantity <= 1) {
        return res.status(400).send({ message: "Minimum quantity is 1" });
      }

      const update = {
        $inc: { quantity: -1 },
      };

      const result = await cartCollection.updateOne(filter, update);
      res.send(result);
    });

    app.delete("/cartDelete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/cartDeleteAll", async (req, res) => {
      const result = await cartCollection.deleteMany();
      res.send(result);
    });

    // campain time
    app.get("/allCampaign", async (req, res) => {
      const result = await campaignCollection.find().toArray();
      res.send(result);
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
      const { id } = req.params;
      const { isActive } = req.body;

      const result = await campaignCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isActive } },
      );

      res.send(result);
    });

    app.post("/campaign", async (req, res) => {
      try {
        const { title, startTime, endTime } = req.body;
        const campaign = {
          title,
          startTime: parseInt(startTime),
          endTime: parseInt(endTime),
          isActive: true,
          createdAt: new Date(),
        };

        const result = await campaignCollection.insertOne(campaign);

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to create campaign" });
      }
    });

    // mergeCart
    app.post("/merge-cart", async (req, res) => {
      const { guestId, userEmail } = req.body;

      const guestCart = await cartCollection
        .find({ userId: guestId })
        .toArray();

      for (const item of guestCart) {
        const exists = await cartCollection.findOne({
          userId: userEmail,
          productId: item.productId,
        });

        if (exists) {
          await cartCollection.updateOne(
            { _id: exists._id },
            { $inc: { quantity: item.quantity } },
          );
        } else {
          await cartCollection.insertOne({
            ...item,
            userId: userEmail,
          });
        }
      }

      // delete guest cart
      await cartCollection.deleteMany({ userId: guestId });

      res.send({ success: true });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// routes
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

module.exports = app;
