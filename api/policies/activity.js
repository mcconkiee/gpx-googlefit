var _randomstring = require("randomstring"),
    fitimporter = require('../../lib/fitimporter');
module.exports = function(req, res, next) {
    fitimporter.profile(function(err, profile) {
        if (err) {
            return next(err)
        }
        var randomstring = req.session.randomstring
        if (!randomstring) {
            randomstring = _randomstring.generate()
        }
        req.session.randomstring = randomstring
        Activity.findOne({
            sessionid: randomstring
        }).then(function(activity) {
            if (activity) {
                req.session.activity = activity
                next()
            } else {
                Activity.create({
                    sessionid: randomstring
                }).then(function(activity) {
                    req.session.activity = activity
                    next()
                })
            }

        })
    })

    return
};