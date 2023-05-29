const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000



const app = express()


const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;



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
    const reviewsCollection = flavorDb.collection("reviews");
    const cartCollection = flavorDb.collection("carts");


    app.get('/menu', async (req, res)=> {
        try {
             const result = await menuCollection.find().toArray();

             res.send({message:'success', data:result })
        } catch (error) {
              res.send({ message: "error", data: [], error:error });
        }   
    } )
    //reviews
    app.get('/reviews', async (req, res)=> {
        try {
             const result = await reviewsCollection.find().toArray();

             res.send({message:'success', data:result })
        } catch (error) {
              res.send({ message: "error", data: [], error:error });
        }   
    } )
 
    // cart collection 
    app.post('/carts', async (req, res)=> {
      try {
         const item = req.body;
         //console.log(item);
         const result = await cartCollection.insertOne(item);
        res.send(result)
      } catch (error) {
        res.send(error)
      }     
    } )

    app.get('/carts', async (req, res)=> {
       const email = req.query.email;     
      
      try {
        if(!email){
                
          res.send({ message: "failed no email", data: [] });
        }else {
          const query = { curtomer_email: email };
        
          const cursor = cartCollection.find(query);
          const data = await cursor.toArray()
          res.send({message:"ok", data:data})
        }
      } catch (error) {
        res.send({ message: "query failed", data: [] });
      }
    } )

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



// middleware 
app.use(cors())
app.use(express.json())

app.get('/', (req, res)=> {
    res.send('Flavor fiesta')
} )

app.listen(port, ()=> {
    console.log('Flavor fiesta server');
} )
