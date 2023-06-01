const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
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


    /**jwt token related apis */

    app.post('/jwt', (req, res)=> {
      const user = req.body 
      const token = jwt.sign(user, secret, {expiresIn:'4h'})
      
      res.send({token})

    } )
    // WARNING use veriryJWT before useing verifyAdmin
    const verifyAdmin = async (req, res,next)=> {
        const email = req.decoded.email
        const query = {email:email}
        const user = await usersCollection.findOne(query)

        if(user?.role !== 'admin' ){
          return res
            .status(403)
            .send({ error: true, message: "forbidden message", data: [] });
        }
        next();
    }

    /** jwt token related apis */

    /**
     * 1. use jwt token
     */

    app.get('/users',verifyJWT,verifyAdmin, async (req, res)=> {

      try {
          const cursor = usersCollection.find();
          const result = await cursor.toArray();
          res.send({ messsage: "success", data: result });
      } catch (error) {
        res.send({message:"error", data:[]})
      }
        } )


    // checking admin role 
    // security layer: verifyJWT 
    // email same
    // 
    app.get('/users/admin/:email',verifyJWT,  async (req, res)=> {
      const decodedEmail = req.decoded.email
     
      const email = req.params.email 

      if(decodedEmail !== email){
        return res.status(401).send({admin:false})
      }

      const query = {email: email }

      const user = await usersCollection.findOne(query)
      const result = {admin : user?.role === 'admin'}
      res.send(result)
    } )


    // updating user role 
    app.patch('/users/admin/:id', async (req, res)=> {
        const id = req.params.id 
        const filter = {_id : new ObjectId(id)}
        const updateDoc = {
          $set: {
            role: 'admin'
          }
        }

        const result = await usersCollection.updateOne(filter, updateDoc)

        res.send(result)
    } )

    // users related apis 
    app.post('/users', async (req, res)=> {
        const user = req.body 
    
        const userEmail = user.email       
        const query = { email: userEmail };

        const existingUser = await usersCollection.findOne(query)   
 
        if(existingUser){
         
          return res.send({message:'user already exists'})
        }else { 
        
           const result = await usersCollection.insertOne(user);
           res.send(result);
        }        
    } )

    // menu related apis 
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

    // cart items by email 

    app.get('/carts',verifyJWT ,async (req, res)=> {
      const decotedEmail = req.decoded.email
   //   console.log(decotedEmail)
       const email = req.query.email;     

       if(email !== decotedEmail){
        return res.status(403).send({error:true, message: "forbidden access", data: [] });
       }
      
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

    // delete cart item 
    app.delete('/carts/:id' , async (req, res)=> {
      const id = req.params.id 
      const query = {_id : new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)

      res.send(result)

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
