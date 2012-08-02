var fs = require('fs');

var builder = module.exports = function(callback) {
  fs.readFile(__dirname + '../lib/io.js', function(err, content) {
    if (err) {
      return callback(err);
    }

    return callback(null, content);
  }
};
