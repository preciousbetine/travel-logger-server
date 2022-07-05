const crypto = require('crypto');

// User profile middleware for confirming existing users or creating new ones
const checkUser = async (req, res, next) => {
  console.log(req.path);
  let token = req.cookies['user_session_id'];

  if (token !== undefined) {
    let existingUser = [];
    // Find the user with that sessionId
    let existingUserCursor = await req.db.collection('users').find({ sessionId: token });
    await existingUserCursor.forEach((entry) => existingUser.push(entry));
    // If such user exists
    if (existingUser.length > 0) {
      // User is logged in already
      console.log('checkUser() - Found user with session token ');
      req.user = existingUser[0];
      return next();
    }
    else {
      // No User with that token is logged in: clear the false cookie
      console.log('checkUser() - User\'s token is invalid');
      res.clearCookie('user_session_id', {
        sameSite: 'none',
        secure: true,
      });
      res.clearCookie('session-token', {
        sameSite: 'none',
        secure: true,
      });
      return res.end();
    }
  }
  else {
    // Check if the request came with a user object. If not end the response
    if (!req.user) {
      console.log('No user token found');
      return res.json({error: 'No Token Specified'});
    }
    let existingUser = [];
    let existingUserCursor = await req.db.collection('users').find({ email: req.user.email });
    await existingUserCursor.forEach((entry) => existingUser.push(entry));
    if (existingUser.length > 0) {
      console.log('checkUser() - User already exists ');
      req.user = existingUser[0];
    }
    else {
      // Create a new user
      const newUser = {
        ...req.user, // contains email, name, picture
        followers: [],
        following: [],
        location: '',
        website: '',
        description: '',
        experiences: [],
      };
      await req.db.collection('users').insertOne(newUser);
      console.log('checkUser() - New User Added');
      req.user = newUser;
      req.isNewUser = true;
    }
    next();
  }
}

const emailLogin = async (req) => {
  const email = req.body.email;
  const password = req.body.password;
  console.log("emailLogin() - User signing in with email and password", email, password);

  let existingUser = [];

  let existingUserCursor = await req.db.collection('users').find({ email });
  await existingUserCursor.forEach((entry) => existingUser.push(entry));
  
  if (existingUser.length > 0) {
    // User exists - check if passwords match
    if (existingUser[0].password === password) {
      console.log('emailLogin() - Username and password correct!');
      const sessionId = crypto.randomBytes(90).toString('base64');
      if (existingUser[0].sessionId) {
        existingUser[0].sessionId.push(sessionId);
      }
      else {
        existingUser[0].sessionId = [sessionId];
      }
      await req.db.collection('users').findOneAndUpdate(
        { _id: existingUser[0]._id },
        { $set: { 
            sessionId: existingUser[0].sessionId,
          } 
        }
      );
      return sessionId;
    }
    else {
      return {error: 'Incorrect email or password'};
    }
  }
  else {
    return {error: 'Incorrect email or password'};
  }
}

const emailSignUp = async (req) => {
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;
  console.log("emailSignUp() - User signing up");

  let existingUser = [];
  let userExists = false;

  let existingUserCursor = await req.db.collection('users').find({ email });
  await existingUserCursor.forEach((entry) => existingUser.push(entry));
  
  if (existingUser.length > 0) {
    // User with email already exists
    console.log('emailSignUp() - Email Already Taken');
    userExists = true;
    return {error: 'Email Already Taken'};
  }

  if (userExists) return;
  // Generate a sessionId for the user
  const sessionId = crypto.randomBytes(90).toString('base64');
  
  // At this point, we create a new user and add it to the db
  const newUser = {
    email,
    password,
    name,
    sessionId: [sessionId], 
    followers: [],
    following: [],
    location: '',
    description: '',
    website: '',
    picture: '62c01dd258b4dbaf7670a4e1',
    experiences: [],
  }
  await req.db.collection('users').insertOne(newUser);
  console.log('emailSignUp() - New User Created');
  return sessionId;
}

module.exports = { checkUser, emailLogin, emailSignUp };