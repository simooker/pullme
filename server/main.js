var FirebaseTokenGenerator = require('firebase-token-generator');
var Queue = require('firebase-queue');
var Firebase = require('firebase');
var Log = require('./log');
var config = require('./config');

var ref = new Firebase(config.firebase.account);
var Models = require('./models')(ref);

var Meetups = require('./tasks/meetups')(Models);
var Accounts = require('./tasks/accounts')(Models);
var Profiles = require('./tasks/profiles')(Models);
var Requests = require('./tasks/requests')(Models);

var tokenGenerator = new FirebaseTokenGenerator(config.firebase.token);
var token = tokenGenerator.createToken({}, {'admin': true});

ref.authWithCustomToken(token, function(error, authData){
  if (error) {
    Log.error('authentication failed', error);
    return false;
  }

  var queue = new Queue(ref.child('queue'), processQueue);
});

function processQueue(data, progress, resolve, reject) {
  Log.info('recieved a new task', data);
  
  var unknownTask = true; 
  
  if (!data) { 
    Log.error('missing data from the new task');
    return false;
  }
  
  if (data.task === 'meetup') {
    unknownTask = false;
    Meetups
      .process(data)
      .then(resolve, reject);
  }

  if (data.task === 'account') {
    unknownTask = false;
    Accounts
      .process(data)
      .then(resolve, reject);
  }

  if (data.task === 'profile') {
    unknownTask = false;
    Profiles
      .process(data)
      .then(resolve, reject);
  }

  if (data.task === 'request') {
    unknownTask = false;
    Requests
      .process(data)
      .then(resolve, reject);
  }

  if (unknownTask) {
    Log.error('unable to process this task', data);
    reject();
  }
}