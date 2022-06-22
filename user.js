const res = require("express/lib/response");

const getFullInfo = async (req) => {
  console.log('getFullInfo() - Getting Full User Information');
  // Fetch User from db
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));
  user = user[0];

  user.followingCount = user.following.length;
  user.followersCount = user.followers.length;
  delete user.experiences;
  delete user.following;
  delete user.followers;
  delete user.sessionId;
  delete user.password;
  return user;
};

const updateUserInfo = async (req) => {
  console.log('updateUserInfo() - Updating User Information');
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));
  user = user[0];

  if (req.body.profilePicSrc) {
    if (req.body.profilePicSrc.startsWith('data:image')) {
      let imageId = await req.db.collection('photos').insertOne({
        image: req.body.profilePicSrc,
      });
      user.picture = imageId.insertedId.toString();
    } else {
      user.picture = req.body.profilePicSrc;
    }
  }

  await req.db.collection('users').findOneAndUpdate(
    { email: user.email },
    { $set: { 
        name: req.body.newUserName,
        location: req.body.newUserLocation,
        website: req.body.newUserWebsite,
        description: req.body.newUserBio,
        picture: user.picture,
      } 
    }
  );

  return {success: true};
};

const updateUserCredentials = async (req) => {
  console.log('updateUserCredentials() - Updating User Credentials');
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));
  user = user[0];

  await req.db.collection('users').findOneAndUpdate(
    { email: user.email },
    { $set: { 
        password: req.body.newPassword,
      } 
    }
  );

  return {success: true};
};

const getRandomUsers = async (req) => {
  console.log('getRandomUsers() - Fetching random users')
  const agg = [
    {
      $match: {
        'email': {
          '$ne': req.user.email
        }
      }
    },
    {
      $sample: {
        'size': 5
      }
    }
  ];

  let usersCursor = await req.db.collection('users').aggregate(agg);

  let users = [];
  await usersCursor.forEach((user) => users.push({
    id: user._id,
    name: user.name,
    picture: user.picture,
    location: user.location,
  }));

  console.log(users);

  return {users};
};

const searchUser = async (req) => {
  console.log('Searching for users with: ', req.params.name);
  
  let nameRegex = new RegExp(req.params.name, 'i');
  let usersCursor = await req.db.collection('users').find({ name: { $regex: nameRegex } });

  let users = [];
  await usersCursor.forEach((user) => users.push({
    id: user._id,
    name: user.name,
    picture: user.picture,
  }));
  console.log(users);

  return {users};
}

module.exports = { 
  getFullInfo,
  updateUserInfo,
  updateUserCredentials,
  getRandomUsers,
  searchUser,
};