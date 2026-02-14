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

app.use(
  cors({
    origin: "http://localhost:5173",
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

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // JWT token verification middleware
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email required" });
      }

      const user = { email };
      const token = jwt.sign(user, process.env.JWT_ACCESS, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true, // true in production
          sameSite: "none",
          maxAge: 24 * 60 * 60 * 1000,
        })
        .send({ success: true });
    });

    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      jwt.verify(token, process.env.JWT_ACCESS, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;

        next();
      });
    };

    // console.log(verifyToken)

    app.get("/allproducts", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
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
      // console.log(data)
      const result = await productCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/allProduct/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(query)
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

    app.get("/orders", verifyToken, async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.get("/orderConfirm", verifyToken, async (req, res) => {
      const result = await confirmOrderCollection.find().toArray();
      res.send(result);
    });

    app.post("/orders", async (req, res) => {
      const userOrderInfo = req.body;
      let result = await orderCollection.insertOne(userOrderInfo);
      // 🔔 notification create

      try {
        await notificationCollection.insertOne({
          type: "order",
          orderId: result.insertedId, // ✅ correct
          message: "New order received",
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      } catch {
        console.log(error);
      }

      res.send(result);
    });

    app.post("/orderConfirm/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await confirmOrderCollection.insertOne(query);
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
      // const email = req.query.email;

      const result = await cartCollection.find().toArray();
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
    app.patch("/cart/DataIncrement/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // get current cart item
      const cartItem = await cartCollection.findOne(filter);

      if (!cartItem) {
        return res.status(404).send({ message: "Cart item not found" });
      }

      // if (cartItem.quantity >= 1) {
      //   return res.status(400).send({ message: "Minimum quantity is 1" });
      // }

      const update = {
        $inc: { quantity: 1 },
      };

      const result = await cartCollection.updateOne(filter, update);
      res.send(result);
    });
    // cart quantity decrement
    app.patch("/cart/DataDecrement/:id", async (req, res) => {
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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
