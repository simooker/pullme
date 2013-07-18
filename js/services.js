(function(angular) {
  var services = angular.module('pullme.services', []);

  services.factory('authManager', [
    '$rootScope',
    '$timeout',
    'localStorage',
    'FIREBASE_URL',

    function($rootScope, $timeout, localStorage, FIREBASE_URL) {
      return function() {
        $rootScope.auth = {
          authenticated: false,
          user: null,
          email: null,
          provider: localStorage.get('authProvider')
        };

        var _set = function(event, args) {
          $timeout(function() {
            $rootScope.auth = {
              authenticated: true,
              user: args.user.id,
              email: args.user.email,
              provider: args.user.provider
            };
            localStorage.set('authProvider', args.user.provider);
          });
        };

        var _create = function(event, args){
          $rootScope.$on('auth.login', function(){
            $timeout(function(){
              var users = new Firebase(FIREBASE_URL);
              var time = new Date();
              var data = {
                email: args.user.email,
                created: time,
                lastUpdated: time,
                lastLogin: time
              };
              users.child('/users/'+args.user.id).set(data);
            });
          });
        };

        var _unset = function() {
          $timeout(function() {
            $rootScope.auth = {
              authenticated: false,
              user: null,
              provider: $rootScope.auth && $rootScope.auth.provider
            };
          });
        };

        $rootScope.$on('auth.login', _set);
        $rootScope.$on('auth.error', _unset);
        $rootScope.$on('auth.logout', _unset);
        $rootScope.$on('auth.signup.success', _create);
      }
    }
  ]);

  services.factory('firebaseAuth', [
    '$rootScope',
    'FIREBASE_URL',
    '$location',
    'authManager',
    '$log',

    function($rootScope, FIREBASE_URL, $location, authManager, $log) {
      return function() {
         authManager();

         var _status = function(error, user) {
            if(error) {
               $log.info('auth.error', error, user);
               $rootScope.$broadcast('auth.error', {error: error, user: user});
            } else if(user ) {
               $log.info('auth.login', user);
               $rootScope.$broadcast('auth.login', {user: user});
            } else {
               $log.info('auth.logout');
               $rootScope.$broadcast('auth.logout', {});
            }
         };

         var client = new FirebaseSimpleLogin(new Firebase(FIREBASE_URL), _status);

         var _methods = {
          signup: function(user){
            client.createUser(user.email, user.password, function(error, newUser){
              if(error){
                $log.info('auth.signup.error', error, newUser);
                $rootScope.$broadcast('auth.signup.error', {error: error, user: newUser});
              } else if(newUser){
                $log.info('auth.signup.success', newUser);
                $rootScope.login('password', user);
                $rootScope.$broadcast('auth.signup.success', {user: newUser});
              }
            });
          },
          login: function(provider, user) {
            switch(provider) {
              case 'twitter':
                client.login('twitter', { rememberMe: true });
              break;
              case 'facebook':
                client.login('facebook', {
                  rememberMe: true,
                  scope: 'email'
                });
              break;
              case 'password':
                client.login('password', {
                  email: user.email,
                  password: user.password,
                  rememberMe: true
                });
              break;
            }
          },
          logout: function() {
             $rootScope.$broadcast('auth.beforeLogout');
             client.logout();
          }
        };

        angular.extend($rootScope, _methods);
        return _methods;
      };
    }
  ]);

  services.factory('PullsManager', [
    '$timeout',
    '$location',
    'FIREBASE_URL',
    'angularFireCollection',
    'angularFire',

    function($timeout, $location, FIREBASE_URL, angularFireCollection, angularFire) {
      return function($scope, user) {
        var _client = new Firebase(FIREBASE_URL);
        var _methods = {
          getPulls: function(user){
            if(user){
              $scope.pulls = angularFire(FIREBASE_URL+'users/'+user+'/pulls', $scope, 'pulls', {});
            } else {
              $scope.pulls = angularFireCollection(FIREBASE_URL+'pulls');
            }
          },
          getPull: function(pullId){
            $scope.loading = true;
            var auth = $scope.auth,
            pullRef = _client.child('/pulls/'+pullId);

            pullRef.on('value', function(snapshot) {
              $timeout(function(){
                $scope.pull = snapshot.val();
                $scope.loading = false;
              });
            });
          },
          addPull: function(){
            $scope.loading = true;
            var auth = $scope.auth,
            newPull = _client.child("/pulls").push(),

            newPullData = {
              id: newPull.name(),
              boat: $scope.boat,
              schedule: $scope.schedule,
              pulltypes: $scope.pulltypes,
              location: $scope.location,
              user_id: auth.user
            };

            newPull.set(JSON.parse(angular.toJson(newPullData)), function(error){
              if(error){
                $scope.loading = false;
                $scope.$broadcast('pulls.add.error', {error: error});
              } else {
                $scope.loading = false;
                _client.child('/users/'+auth.user+'/pulls/'+newPull.name()).set({id:newPull.name()});
                $scope.$broadcast('pulls.add.success', {pull: newPull.name()});

                $timeout(function(){
                  $location.path('/pulls/'+newPull.name());
                }, 250);
              }
            });
          },
          removePull: function(pullId){
            var auth = $scope.auth;
            if(pullId){
              _client.child('/pulls/'+pullId).remove(function(error){
                if(error){
                  $scope.$broadcast('pulls.remove.error', {error: error});
                } else {
                  _client.child('/users/'+auth.user+'/pulls/'+pullId).remove();
                  $scope.$broadcast('pulls.remove.success', {});
                }
              });
            }
          },
          addRequest: function(pullId){
            $scope.loading = true;
            var auth = $scope.auth,
            newRequest = _client.child('/pulls/'+pullId+'/requests').push();

            newRequest.set(JSON.parse(angular.toJson($scope.request)), function(error){
              if(error){
                $timeout(function(){
                  $scope.loading = false;
                });
                $scope.$broadcast('requests.add.error', {error: error});
              } else {
                $timeout(function(){
                  $scope.loading = false;
                });
                _client.child('/users/'+auth.user+'/requests/'+newRequest.name()).set({id:newRequest.name()});
                $scope.$broadcast('requests.add.success', {pull: newRequest.name()});
              }
            })
          }
        };

        return _methods;
      }
    }
  ]);

  /**
  * A utility to store variables in local storage, with a fallback to cookies if localStorage isn't supported.
  * https://github.com/firebase/firereader/blob/gh-pages/app/js/util.js
  */
  services.factory('localStorage', [

    function() {
      //todo should handle booleans and integers more intelligently?
      var loc = {
         /**
          * @param {string} key
          * @param value  objects are converted to json strings, undefined is converted to null (removed)
          * @returns {localStorage}
          */
         set: function(key, value) {
            var undefined;
            if( value === undefined || value === null ) {
               // storing a null value returns "null" (a string) when get is called later
               // so to make it actually null, just remove it, which returns null
               loc.remove(key);
            }
            else {
               value = angular.toJson(value);
               if( typeof(localStorage) === 'undefined' ) {
                  cookie(key, value);
               }
               else {
                  localStorage.setItem(key, value);
               }
            }
            return loc;
         },
         /**
          * @param {string} key
          * @returns {*} the value or null if not found
          */
         get: function(key) {
            var v = null;
            if( typeof(localStorage) === 'undefined' ) {
               v = cookie(key);
            }
            else {
               //todo should reconstitute json values upon retrieval
               v = localStorage.getItem(key);
            }
            return angular.fromJson(v);
         },
         /**
          * @param {string} key
          * @returns {localStorage}
          */
         remove: function(key) {
            if( typeof(localStorage) === 'undefined' ) {
               cookie(key, null);
            }
            else {
               localStorage.removeItem(key);
            }
            return loc;
         }
      };
      return loc;
    }
  ]);
})(angular);