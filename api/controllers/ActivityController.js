/**
 * ActivityController
 *
 * @description :: Server-side logic for managing activities
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var async = require('async'),
    fs = require('fs'),
    _ = require('underscore'),
    fitimporter = require('../../lib/fitimporter');


module.exports = {
    go: function(req, res) {
        var url = fitimporter.authUrl()
        res.redirect(url)
    },
    oauthcallback: function(req, res) {
        var code = req.param('code');
        fitimporter.handleAuthCallback(code, function(err, dataSources) {
            if (!err) {
                return res.redirect('/activity/new')
            }
            return res.serverError({
                error: err,
                data: "error for : fitness.users.dataSources"
            })
        })
    },
    new: function(req, res) {
        res.ok({
            activity: req.session.activity
        })
    },
    refresh: function(req, res) {
        fitimporter.refresh(function(err, tokens) {
            if (err) {
                return res.redirect("/activity/reset")
            }
            Activity.update({
                id: req.session.activity.id
            }, tokens).then(function(updated) {
                res.redirect('/activity/new')
            })
        });
    },
    upload: function(req, res) {
        if (req.method == "POST") {
            var activity = req.session.activity
            var uploadFile = req.file('file');
            uploadFile.upload(function onUploadComplete(err, files) {
                //  Files will be uploaded to .tmp/uploads
                if (err) return res.serverError(err);
                if (files[0]) {
                    var filepath = files[0].fd
                    return fitimporter.upload(".tmp/uploads/" + filepath, function (error, data) {
                        if (error) {
                            console.log("error creating import:::: ", JSON.stringify(error, null, '\t'));
                            console.log(JSON.stringify(files));
                            return res.serverError({
                                data: error
                            })
                        }
                        
                        fs.unlink(filepath,function(unlinkerr,data){
                            sails.log.info("end of import, removing ",filepath)    
                            // console.log("end of import", JSON.stringify(data, null, '\t'));
                            return res.send({
                                data: data                                
                            })    
                        })
                        
                    })
                }
                res.serverError() // no files
            });
        }

    },
    reset: function(req, res) {
        delete req.session
        Activity.destroy().then(function() {
            res.redirect('/activity/go')
        })

    }
};