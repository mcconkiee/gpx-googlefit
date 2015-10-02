/**
* Activity.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

  attributes: {
  	access_token:{type:"string"},
  	refresh_token:{type:"string"},
  	sessionid:{type:"string"},
  	datasource:{type:"string"}
  }
};

