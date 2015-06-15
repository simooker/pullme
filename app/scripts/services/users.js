(function(){
  'use strict';

  angular
    .module('findAWake')
    .factory('Users', Users);

  Users.$inject = ['syncData', 'firebaseRef', '$q'];

  function Users(syncData, firebaseRef, $q) {
    var profiles = {};

    var service = {
      get:get,
      getProfile:getProfile,
      updatePublicProfile:updatePublicProfile,
      createPublicProfile:createPublicProfile
    };

    return service; 
    
    function get(id){
      return syncData('users/' + id);
    }

    function getProfile(id){
      if(!id){ return false; }
      if(!profiles[id]){
        profiles[id] = syncData('profiles/' + id);
      }
      return profiles[id];
    }

    function updatePublicProfile(user){
      var profile = firebaseRef('profiles/' + user.userId);
      
      profile.update(
        _.assign(
          JSON.parse(
            angular.toJson(
              _.pick(user, 'avatar','bio','gear','location','name','boats')
            )
          )
        )
      );
    }

    function createPublicProfile(user){
      // ensure user does not have a profile.
      return _checkExistingProfile(user.userId).then(function(data){
        console.debug('profile already exists');
      }, function(){
        return createRef('profiles/' + user.userId, user);  
      });
    }

    function _checkExistingProfile(id) {
      var dfr = $q.defer();
      var profiles = firebaseRef('profiles');
      
      profiles.child(id).once('value', function(snapshot){
        if (snapshot.val() !== null) {
          dfr.resolve(snapshot);
        } else {
          dfr.reject();
        }
      });

      return dfr.promise;
    }

    function createRef(target, data){
      var dfr = $q.defer();
      var ref = firebaseRef(target);
      var refData = JSON.parse(
        angular.toJson(
          _.pick(data, 'name')
        )
      );

      ref.set(refData, function(err){
        if(err){
          dfr.reject(err);
        } else {
          dfr.resolve(ref.name());
        }
      });

      return dfr.promise;
    }
  }
})();