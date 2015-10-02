var fs = require('fs');
module.exports = {
    load: function(name, callback) {
        fs.readFile(__dirname + "/googleDataSources/" + name + ".json", function(error, file) {
            if (error) {
                return callback(error, null)
            }
            callback(null, JSON.parse(file))
        });
    }
}