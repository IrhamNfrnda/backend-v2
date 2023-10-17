var mongoose = require('mongoose');
require('dotenv').config();

var db = process.env.DB || 'local_db';

// localhost Changed to 127.0.0.1
// Because Error 'Error connecting to MongoDB. connect ECONNREFUSED ::1:27017'
// MongoDB seems to be not compatible with NodeJS v17. It should be listening on IPv6 "::1" by default
var url = process.env.DB_URL || '127.0.0.1:27017';   

var DB_ref = mongoose
  .createConnection('mongodb://' + url + '/' + db)

  .on('error', function (err) {
    if (err) {
      console.error('Error connecting to MongoDB.', err.message);
      process.exit(1);
    }
  })
  .once('open', function callback() {
    console.info('Mongo db connected successfully ' + db);
  });

module.exports = DB_ref;
