const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { checkAuthenticated, gTokenSignIn } = require('./googleAuth');
const { checkUser, emailLogin, emailSignUp } = require('./emailAuth');
const {
  getFullInfo,
  updateUserInfo,
  updateUserCredentials,
  getRandomUsers,
  searchUser,
} = require('./user');
const {
  addExperience,
  getExperiences,
  deleteExperience,
  getUserExperiences,
} = require('./experience');

const app = express();
let db = null;

app.use(cors({
  origin: ['http://localhost:3000', 'https://logmytravel.herokuapp.com'],
  credentials: true,
}));

app.use(bodyParser.json({limit: '50mb'}));
app.use(cookieParser());
app.use((req, res, next) => {
  req.db = db;
  next();
})


// Sign in with google token
app.post('/tokensignin', async (req, res) => {
  console.log("post /tokensignin - User signing in with google");
  const token = await gTokenSignIn(req.body.credential);
  if (token.error) {
    res.clearCookie('session-token', {
      sameSite: 'none',
      secure: true,
    });
    res.clearCookie('user_session_id', {
      sameSite: 'none',
      secure: true,
    });
    return res.json({error: 'Invalid token provided'});
  }
  res.cookie('session-token', token, {
    sameSite: 'none',
    secure: true,
  });
  res.send("success");
});

// Sign up with email and password
app.post('/emailSignUp', async (req, res) => {
  const sessionId = await emailSignUp(req);
  if (sessionId.error) {
    res.json(sessionId);
    return;
  }
  res.cookie('user_session_id', sessionId, {
    sameSite: 'none',
    secure: true,
  });
  res.json({});
});

//Sign in with email and password
app.post('/emailLogin', async (req, res) => {
  const sessionId = await emailLogin(req);
  if (sessionId.error) {
    res.json(sessionId);
    return;
  }
  res.cookie('user_session_id', sessionId, {
    sameSite: 'none',
    secure: true,
  });
  res.json({});
});

// Log a user in
app.get('/userLogin', checkAuthenticated, checkUser, (req, res, next) => {
  let user = req.user;
  console.log('get /userLogin - User Successfully Logged In ');
  console.log('get /userLogin, New User: ', req.isNewUser);
  res.json({success: true, isNewUser: req.isNewUser});
});

// Get a photo
app.get('/photo/:id', async (req, res) => {
  console.log(`get photo - fetching photo ${req.params.id}`);
  let objectid;
  try {
    objectid = ObjectId(req.params.id);
  }
  catch (err) {
    console.log(err);
    res.end();
    return;
  }
  let picture = await db.collection('photos').findOne({ _id: objectid });

  if (!picture) {
    res.status(404).send('Picture Not found');
    return;
  }
  const contentType = picture.image.split(';')[0].split(':')[1];

  picture = Buffer.from(picture.image.split(',')[1], 'base64');
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': picture.length,
  });
  console.log(`get photo - sending photo ${req.params.id}`);
  res.end(picture);
});

// Get Full User Information
app.get('/myFullInfo', checkAuthenticated, checkUser, async (req, res, next) => {
  const userInfo = await getFullInfo(req);
  res.json(userInfo);
});

// Get User's own Experiences
app.get('/myExperiences', checkAuthenticated, checkUser, async (req, res, next) => {
  const experiences = await getExperiences(req);
  res.json(experiences);
});

// Get another user's experiences
app.get('/:userId/experiences', async (req, res) => {
  const response = await getUserExperiences(req);
  res.json(response);
});

// Search for users
app.get('/searchUser/:name', async (req, res) => {
  const response = await searchUser(req);
  res.json(response);
})

// Fetch a user with ID
app.get('/user/:id', async (req, res) => {
  console.log(`get user - fetching user ${req.params.id}`);
  let objectid;
  try {
    objectid = ObjectId(req.params.id);
  }
  catch (err) {
    console.log(err);
    res.end();
    return;
  }
  let user = await db.collection('users').findOne({ _id: objectid });

  if (!user) {
    res.status(404).json({error: 'User Not Found'});
    return;
  }

  delete user.email;
  delete user.password;
  delete user.sessionId;
  delete user._id;
  delete user.experiences;

  console.log(`get user - sending user ${req.params.id}`);
  res.json(user);
});

// Update User Information
app.post('/updateUserInfo', checkAuthenticated, checkUser, async (req, res) => {
  const response = await updateUserInfo(req);
  res.json(response);
});

// Update User Password
app.post('/updateUserCredentials', checkAuthenticated, checkUser, async (req, res) => {
  const response = await updateUserCredentials(req);
  res.json(response);
});

app.get('/randomUsers', checkAuthenticated, checkUser, async (req, res) => {
  const response = await getRandomUsers(req);
  res.json(response);
});

// Post a new Experience
app.post('/postExperience', checkAuthenticated, checkUser, async (req, res) => {
  const response = await addExperience(req);
  res.json(response);
});

// Delete an experience
app.delete('/experience/:id', checkAuthenticated, checkUser, async (req, res) => {
  const response = await deleteExperience(req);
  res.status(201).json(response);
});


// Log a user out
app.get('/logout', checkAuthenticated, checkUser, (req, res)=>{
  console.log('Logging user out');
  res.clearCookie('session-token',  {
    sameSite: 'none',
    secure: true,
  });
  res.clearCookie('user_session_id', {
    sameSite: 'none',
    secure: true,
  });
  res.end();
});

const PORT = process.env.PORT || 5000;

//Connect to DB
const uri = fs.readFileSync('credentials.txt').toString();
const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

mongoClient.connect(async function (err, client) {
  if (err) 
  {
    console.log('mongoConnect - Error connecting to db...', err);
    return;
  }

  db = client.db('travelly');
  console.log("mongoConnect - Database connection established");

  // Start Server
  app.listen(PORT, () => {
    console.log('app - App listening on port ', PORT)
  })
});