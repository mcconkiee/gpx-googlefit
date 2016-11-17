var async = require('async'),
    _ = require('underscore'),
    gpxParse = require("gpx-parse"),
    geolib = require('geolib'),
    google = require('googleapis'),
    googleDataSource = require('./googleDataSource'),
    OAuth2 = google.auth.OAuth2,
    oauth2Client = new OAuth2(
        sails.config.AWS.app.clientId,
        sails.config.AWS.app.clientSecret,
        sails.config.AWS.app.callbackURL);
// set auth as a global default
google.options({
    auth: oauth2Client
});


var fitness = google.fitness({
    version: 'v1',
    auth: oauth2Client
});
var googleUser = google.plus({
    version: 'v1',
    auth: oauth2Client
});
//https://developers.google.com/fit/rest/v1/reference/activity-types
var CURRENT_ACTIVITY_TYPE  = {
    RUN : 8,
    BIKE : 16,
    MTN_BIKE:15,
    HIKE : 35
}

module.exports = {
    importer: this,
    user:{
        weight:180,//lbs
    },
    ActivityDataSource: null,
    CalorieDataSource: null,
    DistanceDataSource: null,
    LocationDataSource: null,
    WeightDataSource:null,
    HeightDataSource:null,    
    GoogleActivityType: 16,    
    dataSources:function(){
        return [this.ActivityDataSource,this.CalorieDataSource,this.DistanceDataSource,this.LocationDataSource,this.WeightDataSource,this.HeightDataSource];
    },
    profile:function(callback){
        googleUser.people.get({userId:"me"},callback)
    },
    authUrl: function() {
        // generate a url that asks permissions for Google+ and Google Calendar scopes
        var scopes = [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/fitness.activity.read",
            "https://www.googleapis.com/auth/fitness.activity.write",
            "https://www.googleapis.com/auth/fitness.body.read",
            "https://www.googleapis.com/auth/fitness.body.write",
            "https://www.googleapis.com/auth/fitness.location.read",
            "https://www.googleapis.com/auth/fitness.location.write",
        ];

        var url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
            scope: scopes // If you only need one scope you can pass it as string
        });
        return url
    },
    handleAuthCallback: function(code, auth_callback) {
        var importer = this;
        importer.setup(function() {
            oauth2Client.getToken(code, function(err, tokens) {
                // Now tokens contains an access_token and an optional refresh_token. Save them.
                if (!err) {
                    oauth2Client.setCredentials(tokens);
                    var params = {
                        userId: 'me',
                        auth: oauth2Client
                    };
                    fitness.users.dataSources.list({
                        userId: "me"
                    }, function(err, response) {
                        var ds = importer.dataSources();
                        //add our custom datasources                   
                        async.forEach(
                            ds,
                            function(item, callback) {
                                fitness.users.dataSources.create({
                                    userId: "me",
                                    resource: item
                                }, function(err, g_response) {
                                    
                                    callback() //end async
                                })
                            },
                            function(err) {
                                auth_callback(err, ds);
                            }
                        );

                    })
                }
            });
        })
    },

    //REFRESH THE AUTH w/ GOOGLE
    refresh: function(callback) {
        oauth2Client.refreshAccessToken(function(err, tokens) {
            // your access_token is now refreshed and stored in oauth2Client
            // store these new tokens in a safe place (e.g. database)
            callback(err, tokens)
        });
    },

    //UPLOAD A GPX by filepath.
    //upload_callback expects error, and the final result of the last dataset segment upload
    upload: function(filepath, upload_callback) {
        var importer = this;
        var times = [];
        var points = [];
        var pointsDistance = []
        var pointsLocation = []
        var startNano, endNano = 0
        var totalDistance = 0.001
        var totalCalories = 0.001
        var lastLat, lastLon;
        var currentActivityType = CURRENT_ACTIVITY_TYPE.BIKE;
        importer.setup(function() {
            async.waterfall([
                    //---------> PARSE THE GPX
                    function(callback) {
                        gpxParse.parseGpxFromFile(filepath, function(error, data) {
                            //do stuff 
                            if (!data) {
                                return upload_callback(new Error("no data"), null)
                            }
                            var count = 0
                            if (data.tracks) {
                                data.tracks.forEach(function(track) {
                                    var trackName = track.name                                    
                                    var isRun = (trackName.indexOf("Running") >= 0 || trackName.indexOf("Run") >= 0);
                                    var isHike = (trackName.indexOf("Hiking") >= 0);                                    
                                    var isMtnRide = (trackName.indexOf("Trail") >= 0 || trackName.indexOf("Mountain") >= 0);
                                    if (trackName) {                                        
                                        if (isRun) {                                            
                                            console.log(track.name," THIS IS A RUN");
                                            currentActivityType = CURRENT_ACTIVITY_TYPE.RUN;                                            
                                        }else if (isHike) {
                                            currentActivityType = CURRENT_ACTIVITY_TYPE.HIKE;                                            
                                        }else if (isMtnRide) {
                                            console.log(track.name," THIS IS A MTN_BIKE");
                                            currentActivityType = CURRENT_ACTIVITY_TYPE.MTN_BIKE;                                            
                                        }else{
                                            console.log(track.name," THIS IS A RIDE");
                                            currentActivityType = CURRENT_ACTIVITY_TYPE.BIKE;
                                            
                                        }
                                    }
                                    track.segments.forEach(function(segment) {
                                        lastLat = null
                                        lastLon = null
                                        segment.forEach(function(x) { //GPXWayPoint
                                            var t = new Date(x.time) * 1
                                            if (count == 0) {
                                                times.push(t)
                                                startNano = (t * 1) * 1000000
                                            }
                                            times[1] = t
                                            endNano = (t * 1) * 1000000
                                            totalCalories += (totalDistance * 1000.001)

                                            //---------> POINTS FOR ACTIVITY
                                            var nano = (t * 1) * 1000000
                                            points[0] = {
                                                endTimeNanos: nano,
                                                startTimeNanos: nano,
                                                originDataSourceId: importer.ActivityDataSource.dataStreamId,
                                                dataTypeName: importer.ActivityDataSource.dataType.name,
                                                value: [{
                                                    intVal: currentActivityType
                                                }]
                                            }
                                            //---------> POINTS FOR DISTANCE DELTA
                                            if (!lastLon) {
                                                lastLon = x.lon
                                                lastLat = x.lat
                                            }
                                            var curLat = x.lat
                                            var curLon = x.lon
                                            var delta = geolib.getDistance({
                                                latitude: lastLat,
                                                longitude: lastLon
                                            }, {
                                                latitude: curLat,
                                                longitude: curLon
                                            })
                                            lastLon = curLon;
                                            lastLat = curLat;
                                            totalDistance += delta
                                            pointsDistance[count] = {
                                                endTimeNanos: nano,
                                                startTimeNanos: nano,
                                                originDataSourceId: importer.DistanceDataSource.dataStreamId,
                                                dataTypeName: importer.DistanceDataSource.dataType.name,
                                                value: [{
                                                    fpVal: delta
                                                }]
                                            }

                                            pointsLocation[count] = {
                                                endTimeNanos: nano,
                                                startTimeNanos: nano,
                                                originDataSourceId: importer.LocationDataSource.dataStreamId,
                                                dataTypeName: importer.LocationDataSource.dataType.name,
                                                value: [{
                                                    fpVal: x.lat
                                                }, {
                                                    fpVal: x.lon
                                                }, {
                                                    fpVal: .0001
                                                }, {
                                                    fpVal: x.elevation[0]
                                                }]
                                            }
                                            count++;
                                        })
                                    })
                                })
                            }


                            callback(error, data)
                        })

                    },
                    //---------> CREATE/ADD DATASET FOR com.google.activity
                    function(gpxData, callback) {
                        var datasetId = startNano.toString() + "-" + endNano.toString()
                        var dataSourceResource = {
                            dataSourceId: importer.ActivityDataSource.dataStreamId,
                            datasetId: datasetId,
                            resource: {
                                dataSourceId: importer.ActivityDataSource.dataStreamId,
                                minStartTimeNs: startNano,
                                maxEndTimeNs: endNano,
                                point: points
                            }
                        }
                        var patch = {
                            userId: "me",
                            dataSourceId: importer.ActivityDataSource.dataStreamId,
                            datasetId: dataSourceResource.datasetId,
                            resource: dataSourceResource.resource
                        }

                        // console.log("\r\n\r\n***********ActivityDataSource ****************\r\n");
                        // console.log(JSON.stringify(patch));

                        fitness.users.dataSources.datasets.patch(patch, function(dataset_err, g_response) {

                            callback(dataset_err, patch, dataSourceResource)
                        })
                    },
                    //---------> CREATE/ADD DATASET FOR com.google.distance
                    function(patch, dataSourceResource, callback) {
                        //update patch to reflect Distance
                        patch.dataSourceId = importer.DistanceDataSource.dataStreamId
                        patch.resource.dataSourceId = importer.DistanceDataSource.dataStreamId
                        patch.resource.point = pointsDistance

                        // console.log("\r\n\r\n***********DistanceDataSource ****************\r\n");
                        // console.log(JSON.stringify(patch));


                        fitness.users.dataSources.datasets.patch(patch, function(dataset_err, g_response) {
                            callback(dataset_err, patch, dataSourceResource)
                        })
                    },
                    //---------> CREATE/ADD DATASET FOR com.google.location
                    function(patch, dataSourceResource, callback) {
                        //update patch to reflect Distance
                        patch.dataSourceId = importer.LocationDataSource.dataStreamId
                        patch.resource.dataSourceId = importer.LocationDataSource.dataStreamId
                        patch.resource.point = pointsLocation

                        // console.log("\r\n\r\n***********LocationDataSource ****************\r\n");
                        // console.log(JSON.stringify(patch));

                        fitness.users.dataSources.datasets.patch(patch, function(dataset_err, g_response) {
                            callback(dataset_err, dataSourceResource)
                        })
                    },
                    //---------> CREATE/ADD SESSION
                    function(dataSourceResource, callback) {
                        var sessionData = {
                            "id": "example-fit-" + parseInt(times[0]),
                            "name": "Fit Import",
                            "description": "Imported data from Fit Import",
                            "startTimeMillis": parseInt(times[0]),
                            "endTimeMillis": parseInt(times[1]),
                            "application": importer.ActivityDataSource.application,
                            "activityType": currentActivityType
                        }

                        fitness.users.sessions.update({
                            userId: "me",
                            sessionId: sessionData.id,
                            resource: sessionData
                        }, function(sessions_err, session_response) {
                            callback(sessions_err, dataSourceResource, session_response)
                        })
                    },
                    //---------> CREATE/ADD SEGEMENT SUMMARY  FOR ACTIVITY
                    function(dataSourceResource, session_response, callback) {
                        var segment = {
                            "minStartTimeNs": startNano,
                            "maxEndTimeNs": endNano,
                            "dataSourceId": importer.ActivityDataSource.dataStreamId,
                            "point": [{
                                "startTimeNanos": startNano,
                                "endTimeNanos": endNano,
                                "dataTypeName": importer.ActivityDataSource.dataType.name,
                                "value": [{
                                    "intVal": currentActivityType
                                }]
                            }]
                        }
                        var patch = {
                            userId: "me",
                            dataSourceId: importer.ActivityDataSource.dataStreamId,
                            datasetId: dataSourceResource.datasetId,
                            resource: segment
                        }
                        fitness.users.dataSources.datasets.patch(patch, function(err_patch, patchResponse) {
                            callback(err_patch, dataSourceResource);
                        })
                    },
                    //---------> CREATE/ADD SEGEMENT SUMMARY FOR CALORIES
                    function(dataSourceResource, callback) {
                        var minsWorkingOut = (endNano - startNano) / 100000000000 // number of minutes
                        //rough calcultion
                        //http://www.livestrong.com/article/18303-calculate-calories-burned/                        
                        // (weightInKG (kg) * MET value) * (mins/60)  // 60 mins in an hour                        
                        //http://appliedresearch.cancer.gov/atus-met/met.php
                        var MET = 8.0;
                        switch(currentActivityType){
                            case CURRENT_ACTIVITY_TYPE.RUN:
                            MET = 7.5;
                            break;
                            case CURRENT_ACTIVITY_TYPE.HIKE:
                            MET = 6.0;
                            break;
                            default:
                            MET = 8.0;
                            break;
                        }
                        
                        var cals = (MET * (importer.user.weight / 2.2)) * (minsWorkingOut / 60)
                        sails.log.info("Calories burned: ",cals," | for mins: ",minsWorkingOut," of activity type = ",currentActivityType)    
                        if (isNaN(cals) || cals <= 0) {
                            cals = 0.0
                        }
                        var segment = {
                            "minStartTimeNs": startNano,
                            "maxEndTimeNs": endNano,
                            "dataSourceId": importer.CalorieDataSource.dataStreamId,
                            "point": [{
                                "startTimeNanos": startNano,
                                "endTimeNanos": endNano,
                                "dataTypeName": importer.CalorieDataSource.dataType.name,
                                "value": [{
                                    "fpVal": cals
                                }]
                            }]
                        }

                        var patch = {
                            userId: "me",
                            dataSourceId: importer.CalorieDataSource.dataStreamId,
                            datasetId: dataSourceResource.datasetId,
                            resource: segment
                        }

                        fitness.users.dataSources.datasets.patch(patch, function(err_patch, patchResponse) {
                            callback(err_patch, dataSourceResource);
                        })
                    },
                    //---------> CREATE/ADD SEGEMENT SUMMARY FOR DISTANCE
                    function(dataSourceResource, callback) {
                        //0.048 x weight (lbs) x time (minutes)

                        var segment = {
                            "minStartTimeNs": startNano,
                            "maxEndTimeNs": endNano,
                            "dataSourceId": importer.DistanceDataSource.dataStreamId,
                            "point": [{
                                "startTimeNanos": startNano,
                                "endTimeNanos": endNano,
                                "dataTypeName": importer.DistanceDataSource.dataType.name,
                                "value": [{
                                    "fpVal": totalDistance
                                }]
                            }]
                        }
                        var patch = {
                            userId: "me",
                            dataSourceId: importer.DistanceDataSource.dataStreamId,
                            datasetId: dataSourceResource.datasetId,
                            resource: segment
                        }

                        fitness.users.dataSources.datasets.patch(patch, function(err_patch, patchResponse) {
                            callback(err_patch, patchResponse);
                        })
                    }
                ],
                //---------> HANDLE OVERALL RESPONSE
                function(err, result) {

                    upload_callback(err, result)
                });
        })
    },

    //DEFINES THE DEFAULT DATASOURCES
    setup: function(complete) {
        var importer = this;        
        var ActivityDataSource, CalorieDataSource, DistanceDataSource, LocationDataSource;
        async.series({
                activity: function(callback) {
                    googleDataSource.load('activity', callback)
                },
                calorie: function(callback) {
                    googleDataSource.load('calorie', callback)
                },
                distance: function(callback) {
                    googleDataSource.load('distance', callback)
                },
                location: function(callback) {
                    googleDataSource.load('location', callback)
                },
                weight: function(callback) {
                    googleDataSource.load('weight', callback)
                },
                height: function(callback) {
                    googleDataSource.load('height', callback)
                },
            },
            function(err, results) {
                // results is now equal to: {one: {}, two: {}}
                importer.ActivityDataSource = results.activity;
                importer.CalorieDataSource = results.calorie;
                importer.DistanceDataSource = results.distance;
                importer.LocationDataSource = results.location;
                importer.WeightDataSource = results.weight;
                importer.HeightDataSource = results.height;
                complete();
            });
    }


}