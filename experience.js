const crypto = require('crypto');
const res = require('express/lib/response');
const { ObjectId } = require('mongodb');

const generatePostId = (length) => {
  return `${Math.random()}post${length}`
};

const addExperience = async (req) => {
  console.log('addExperience() - Posting New Experience');
  // Fetch User from db 
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));
  user = user[0];
  req.body.datePosted = new Date();

  for (let i = 0; i < req.body.images.length; i++) {
    let imageId = await req.db.collection('photos').insertOne({
      image: req.body.images[i],
    });
    req.body.images[i] = imageId.insertedId.toString();
  }
  req.body.postId = generatePostId(user.experiences.length);
  console.log(req.body.postId);

  req.body.userEmail = req.user.email;
  const postId = await req.db.collection('posts').insertOne({
    post: req.body,
  });

  user.experiences.push(postId.insertedId.toString());

  // Update User
  await req.db.collection('users').findOneAndUpdate(
    { email: user.email },
    { $set: {
        experiences: user.experiences,
      } 
    }
  );

  console.log('addExperience() - Experience Added');
  return {success: true, experiences: user.experiences.reverse().slice(0, 10)};
};

const getExperiences = async (req) => {
  console.log('getExperiences() - query', req.query);
  let { index } = req.query;
  index = Number(index);

  // Fetch User from db 
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));

  user = user[0];
  user.experiences = user.experiences.reverse();

  if (user.experiences.length < index) return {experiences: []}

  user.experiences = user.experiences.slice(index, index + 10);

  const posts = [];

  for (const experience of user.experiences) {
    let objectid;
    try {
      objectid = ObjectId(experience);
    }
    catch (err) {
      console.log(err);
      return { experiences: [] };
    }
    const post = await req.db.collection('posts').findOne({ _id: objectid });
    posts.push(post.post);    
  }

  return {experiences: posts};
};

const deleteExperience = async (req) => {
  console.log('deletingExperience() - query', req.params);
  let { id } = req.params;

  // Fetch User from db 
  let user = [];
  let userCursor = await req.db.collection('users').find({ email: req.user.email });
  await userCursor.forEach((entry) => user.push(entry));

  user = user[0];
  user.experiences = user.experiences.filter((experience) => experience.postId !== id);

  console.log(user.experience);

  // update user
  await req.db.collection('users').findOneAndUpdate(
    { email: user.email },
    { $set: {
        experiences: user.experiences,
      } 
    }
  );

  return {experiences: user.experiences.reverse().slice(0, 10)};
};

const getUserExperiences = async (req) => {
  console.log('getting user experiences() - params', req.params, ' query: ', req.query);
  let { index } = req.query;
  index = Number(index);

  let objectid;
  try {
    objectid = ObjectId(req.params.userId);
  }
  catch (err) {
    console.log(err);
    return {error: 'Invalid user id'};
  }

  // Fetch User from db 
  let user = [];
  let userCursor = await req.db.collection('users').find({ _id: objectid });
  await userCursor.forEach((entry) => user.push(entry));

  console.log(user);

  user = user[0];
  user.experiences = user.experiences.reverse();

  if (user.experiences.length < index) return {experiences: []}

  user.experiences = user.experiences.slice(index, index + 10);

  const posts = [];

  for (const experience of user.experiences) {
    let objectid;
    try {
      objectid = ObjectId(experience);
    }
    catch (err) {
      console.log(err);
      return { experiences: [] };
    }
    const post = await req.db.collection('posts').findOne({ _id: objectid });
    posts.push(post.post);    
  }

  return {experiences: posts};
}

module.exports = { 
  addExperience,
  getExperiences,
  deleteExperience,
  getUserExperiences,
};
