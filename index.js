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

app.get('/checkFollowing/:id', checkAuthenticated, checkUser, (req, res) => {
  if (req.user.following.indexOf(req.params.id) > -1) res.json({ following: true });
  else res.json({ following: false });
});

// Get a photo
app.get('/photo/:id', async (req, res) => {
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

// Get posts timeline
app.get('/timeline', checkAuthenticated, checkUser, async (req, res) => {
  let { index } = req.query;
  let following = req.user.following.map((userId) => new ObjectId(userId));
  const emails = [];

  for (const id of following) {
    let user = await db.collection('users').find({ _id: id });
    user = await user.next();
    emails.push(user.email);
  }

  let posts = await db.collection('posts').find({
    'post.userEmail': { $in: emails },
  }).sort({ _id: -1 });

  posts = await posts.skip(Number(index)).limit(20).toArray();
  for (const post of posts) {
    let user = await db.collection('users').find({ email: post.post.userEmail });
    user = await user.next();
    delete user._id;
    delete user.email;
    delete user.followers;
    delete user.following;
    delete user.location;
    delete user.website;
    delete user.description;
    delete user.experiences;
    delete user.password;
    delete user.sessionId;
    post.post.user = user;
  }

  res.json({ posts });
});

// Follow a user
app.get('/followUser/:id', checkAuthenticated, checkUser, async (req, res) => {
  if (req.user.following.indexOf(req.params.id) < 0) {
    let objectid;
    try {
      objectid = ObjectId(req.params.id);
    }
    catch (err) {
      console.log(err);
      res.end();
      return;
    }

    console.log('Following user', req.params.id);
    req.user.following.push(req.params.id);
    // update user
    await db.collection('users').findOneAndUpdate(
      { email: req.user.email },
      { $set: {
          following: req.user.following,
        } 
      }
    );

    // Increase followers of user with id
    let user = await db.collection('users').findOne({ _id: objectid });
    user.followers.push(req.user._id.toString());
    // update user
    await db.collection('users').findOneAndUpdate(
      { email: user.email },
      { $set: {
          followers: user.followers,
        } 
      }
    );
      
    res.json({success: true});
  }
  else {
    console.log('Already following user...');
    res.json({success: false});
  }
});

// Unfollow a user
app.get('/unfollowUser/:id', checkAuthenticated, checkUser, async (req, res) => {
  if (req.user.following.indexOf(req.params.id) > -1) {
    let objectid;
    try {
      objectid = ObjectId(req.params.id);
    }
    catch (err) {
      console.log(err);
      res.end();
      return;
    }

    console.log('Unfollowing user ', req.params.id);
    req.user.following.splice(req.user.following.indexOf(req.params.id), 1);
    // update user
    await db.collection('users').findOneAndUpdate(
      { email: req.user.email },
      { $set: {
          following: req.user.following,
        } 
      }
    );

    // Remove user from followers list
    let user = await db.collection('users').findOne({ _id: objectid });
    console.log(user.followers);
    user.followers.splice(user.followers.indexOf(req.user._id.toString()), 1);
    // update user
    await db.collection('users').findOneAndUpdate(
      { email: user.email },
      { $set: {
          followers: user.followers,
        } 
      }
    );

    res.json({ success: true });

    
  } else {
    console.log('Not following User ', req.params.id);
    res.json({ success: false });
  }
})

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