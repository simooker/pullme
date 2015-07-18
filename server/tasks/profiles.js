(function(){
  'use strict';
  var Q = require('q');
  var BadWords = require('bad-words');
  var _ = require('lodash');

  var Log = require('../log');
  var config = require('../config');

  module.exports = function Profiles(firebaseRef) {
    var firebaseRef = firebaseRef;

    var service = {
      process: process
    };

    return service;

    /**
     * Process new accounts from the queue
     */
    function process(task) {
      Log.info('starting Profile task', task)
      var dfr = Q.defer();

      _collectAssociatedTaskData(task)
        .then(_processTaskDataResults)
        .then(dfr.resolve, dfr.reject);

      return dfr.promise;
    }

    function _collectAssociatedTaskData(data) {
      Log.info('collecting associated data', data)
      return _userData(data.userId)
    }

    function _processTaskDataResults(data) {
      Log.info('process task data results', data);
      var dfr = Q.defer();
      var filter = new BadWords();
      var profilesRef = firebaseRef.child('profiles');
      var datum = _.pick(data,'avatar','bio','gear','location','name','boats');     

      if (datum.bio) {
        datum.bio = filter.clean(datum.bio);
      }
      if (datum.name) {
        datum.name = filter.clean(datum.name);
      }

      profilesRef
        .child(data.userId)
        .set(datum, function(error){
          if (error) {
            Log.error('failed to update public profile', error);
            dfr.reject(error);
          } else {
            Log.success('saved public profile', datum);
            dfr.resolve(datum);
          }
        });

      return dfr.promisel
    }

    function _userData(userId) {
      var dfr = Q.defer();
      var users = firebaseRef.child('users');

      users
        .child(userId)
        .once('value', function success(snapshot){
          dfr.resolve(snapshot.val());
        }, function failure(error){
          Log.error('failed to get user snapshot', userId);
          dfr.reject(error);
        });

      return dfr.promise;
    }
  }
})();