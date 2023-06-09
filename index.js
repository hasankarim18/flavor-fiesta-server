const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SK);
// jwt
const jwt = require('jsonwebtoken')
 
const secret = process.env.ACCESS_TOKEN_SECRET
const port = process.env.PORT || 5000
const app = express()

// middle ware 
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;

//middleware
app.use(cors())
app.use(express.json())

/// accesstoken middleware 


/**
 * ***********************************************************
 *        VERIFY JWT
 * **********************************************************
 *  */
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
 // console.log(authorization);

  if(!authorization){
    return res.status(401).send({error:true, message:"unauthorized access"})
  }

  // bearer token 
  const token = authorization.split(' ')[1]

  jwt.verify(token,secret, (err,decoded)=> {
    if(err){
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access" })
    }
    
    req.decoded = decoded;
    next()
    })
};

/**
 * ***********************************************************
 *        VERIFY JWT ENDS
 * **********************************************************
 *  */


const uri =
  `mongodb+srv://${user}:${password}@cluster0.nzfxe6e.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const flavorDb = client.db("flavorDb");
    const menuCollection = flavorDb.collection("menu");
    const usersCollection = flavorDb.collection("users");
    const reviewsCollection = flavorDb.collection("reviews");
    const cartCollection = flavorDb.collection("carts");
    const menuCategoryCollection = flavorDb.collection("menuCategory");
    const paymentCollection = flavorDb.collection("payments");

    /**
     * ***********************************************************
     *       sending token to the front end
     * **********************************************************
     *  */
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, secret, { expiresIn: "4h" });

      res.send({ token });
    });

    /**
     * ***********************************************************
     *     WARNING use veriryJWT before useing verifyAdmin
     * **********************************************************
     *  */
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message", data: [] });
      }
      next();
    };

    /**
     * ***********************************************************
     *    ALL USERS DATA
     *  * ONLY ADMIN WITH VERIFIED TOKEN
     * **********************************************************
     *  */
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const cursor = usersCollection.find();
        const result = await cursor.toArray();
        res.send({ messsage: "success", data: result });
      } catch (error) {
        res.send({ message: "error", data: [] });
      }
    });

    // checking admin role
    // security layer: verifyJWT
    // email same
    //
    /**
     * ***********************************************************
     *   *  WHEN A USER LOGGED IN IT VERIFIES IT THAT IT is admin or user
     * **********************************************************
     *  */
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;

      const email = req.params.email;

      if (decodedEmail !== email) {
        return res.status(401).send({ admin: false });
      }

      const query = { email: email };

      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    /**
     * ***********************************************************
     *   * Updating user role by admin
     * **********************************************************
     *  */
    // updating user role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);

      res.send(result);
    });

    /***
     *  
     *  SAVING USER DATA WHEN SIGN UP
     */
    app.post("/users", async (req, res) => {
      const user = req.body;

      const userEmail = user.email;
      const query = { email: userEmail };

      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      } else {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });


    /***
     * GETTING MENU
     */
    // menu related apis
    app.get("/menu", async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
     
        res.send({ message: "success", data: result });
      } catch (error) {
        res.send({ message: "error", data: [], error: error });
      }
    });

    /***
     *  ADDING MENU ONLY ADMIN #addmenu
     */
    app.post("/menu", verifyJWT,verifyAdmin,  async (req, res) => {
      const newItem = req.body
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    });

    /**
     * Delete Menu only admin area 
     */
    app.delete('/menu/:id',verifyJWT, verifyAdmin, async (req, res)=>  {
        const id = req.params.id;
    
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
      
        res.send(result);
    } )

    //reviews
    app.get("/reviews", async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();

        res.send({ message: "success", data: result });
      } catch (error) {
        res.send({ message: "error", data: [], error: error });
      }
    });

    // cart collection
    app.post("/carts", async (req, res) => {
      try {
        const item = req.body;
        //console.log(item);
        const result = await cartCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // cart items by email

    app.get("/carts", verifyJWT, async (req, res) => {
      const decotedEmail = req.decoded.email;
      //   console.log(decotedEmail)
      const email = req.query.email;

      if (email !== decotedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access", data: [] });
      }

      try {
        if (!email) {
          res.send({ message: "failed no email", data: [] });
        } else {
          const query = { curtomer_email: email };

          const cursor = cartCollection.find(query);
          const data = await cursor.toArray();
          res.send({ message: "ok", data: data });
        }
      } catch (error) {
        res.send({ message: "query failed", data: [] });
      }
    });

    // delete cart item
    app.delete("/carts/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);

      res.send(result);
    });

    // add Category
    app.get("/menuCategory", async (req, res) => {
      const cursor = menuCategoryCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    /***
     * 1. Create payment intent
     */
      app.post('/create-payment-intent',verifyJWT, async (req, res)=> {
        try {
            const { price } = req.body;
           
            const amount = price * 100; //
            const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: "usd",
              payment_method_types: ["card"],
            });

            res.send({
              clientSecret: paymentIntent.client_secret,
            });

        } catch (error) {
          res.send({
            clientSecret: ''
          });
        }
      

      })

      /**
       * PAYMENT RELATED API 
       */
      app.post('/payments',verifyJWT, async (req, res)=> {
          const payment = req.body 
        
          const cartItems = payment.cartItems;
          const insertResult = await paymentCollection.insertOne(payment)

          const query = {_id:{$in: cartItems.map(id => new ObjectId(id) )}}

          const deleteResult = await cartCollection.deleteMany(query)
          res.send({insertResult, deleteResult})
      } )

      /**
       * ADMIN RELATED ROUTES 
       */

      app.get('/admin-stats',verifyJWT, verifyAdmin, async (req, res)=> {
          const users = await usersCollection.estimatedDocumentCount()
          const products = await menuCollection.estimatedDocumentCount()
          const orders = await paymentCollection.estimatedDocumentCount()

          // best way to get sum of a field is to use group and sum operator

          // bangla system
          const payments = await paymentCollection.find().toArray()

          const revenue = parseFloat(
            payments
              .reduce((sum, item) => {
                return sum + item.price;
              }, 0)
              .toFixed(2)
          );

          res.send({
            users,
            products,
            orders,
            revenue
          })
      } )


      /**
       * ORDER STATS second best solution
       * 1. load all payments
       * 2. for each payment get the menuItems array
       * 3. for each each item in the menuItems array get the menu item from the munu collection
       * 4. put them in an array : all orderedItems
       * 5. separate all orderedItems by category 
       * 6. now get the quantity by using length: pizzas.length
       * 7. for each category use reduct to get the total amount spent on this category
       */

      app.get('/order-stats', async (req, res)=> {

      })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  //  await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res)=> {
    res.send('Flavor fiesta')
} )

app.listen(port, ()=> {
    console.log('Flavor fiesta server');
} )
