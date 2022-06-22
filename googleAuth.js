const {OAuth2Client} = require('google-auth-library');
const CLIENT_ID = "585291370033-3p13pavgsncbcdhkcvh71db7r5jv91ra.apps.googleusercontent.com";
const googleClient = new OAuth2Client(CLIENT_ID);

// Google Token Authentication MiddleWare
const checkAuthenticated = async (req, res, next) => {
  let token = req.cookies['session-token'];
  console.log(req.path);
  console.log('checkAuthenticated() - Authenticating with google token');
  if (!token) return next();
  try {
    let user = {};
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    user.name = payload.name;
    user.email = payload.email;
    user.picture = payload.picture;

    req.user = user;
    console.log('checkAuthenticated() - Token authenticated successfully.');
    next();
  }
  catch (err) {
    console.log('checkAuthenticated() - Google token error. Clearing cookie.');
    res.clearCookie('session-token');
    res.end();
  }
}

const gTokenSignIn = async (token) => {
  try {
    await googleClient.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    return token;
  }
  catch (error) {
    console.log("gTokenSignIn() Error: ", error);
    return { error };
  }
}

module.exports = { checkAuthenticated, gTokenSignIn };