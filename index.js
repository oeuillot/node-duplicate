var program = require('commander');
var crypto = require('crypto');
var fs = require('fs');
var Path = require('path');
var Async = require('async');

var filesRepository = {};
var filesCount = 0;

var maxHashSize = 1024 * 1024;

var filesSHA1 = Async.queue(function(path, callback) {
  // console.log("SHA1 of " + path);
  var shasum = crypto.createHash('sha256');
  var max = program.maxHashSize || maxHashSize;

  var count = 0;
  var s = fs.ReadStream(path);
  var closed = false;

  function end() {
    if (closed) {
      return;
    }
    closed = true;

    s.close();

    var d = shasum.digest('base64');

    fs.lstat(path, function(error, stats) {
      if (error) {
        return callback(error);
      }
      // console.log("SHA1Stat " + path + " => " + filesRepository[stats.size]);
      var g = filesRepository[stats.size][d];
      if (!g) {
        g = [];
        filesRepository[stats.size][d] = g;
      }
      g.push(path);

      return callback(null);
    });
  }

  s.on('data', function(d) {
    if (closed) {
      return;
    }
    count += d.length;

    shasum.update(d);

    if (max > 0 && count > max) {
      end();
    }
  });

  s.on('end', end);

}, 1);

var directories = Async.queue(function(directory, callback) {

  console.log("Scan directory " + directory);
  fs.readdir(directory, function(error, files) {
    if (error) {
      return callback(error);
    }

    Async.forEach(files, function(file, callback) {

      var path = directory + Path.sep + file;

      fs.lstat(path, function(error, stats) {

        // console.log("Stat " + file + " " + stats);
        if (error) {
          return callback(error);
        }

        if (stats.isDirectory()) {
          // console.log("Add directories " + file);
          directories.push(path);

        } else if (stats.isFile() && stats.size) {
          // console.log("Stat file " + file);
          filesCount++;

          var fs = filesRepository[stats.size];
          if (!fs) {
            fs = {
              ____count : 1
            };
            filesRepository[stats.size] = fs;
            fs['?'] = path;

          } else if (fs.____count == 1) {
            filesSHA1.push(fs['?']);
            delete fs['?'];
            filesSHA1.push(path);
            fs.____count++;

          } else {
            fs.____count++;
            filesSHA1.push(path);
          }
        }

        return callback(null);
      });
    }, callback);
  });

});

program.option("-d, --directory <path>", "Directory", function(p) {
  directories.push(p);
  return p;
});

program.option("-r, --remove", "Remove duplicate file");
program.option("--removeAllo", "Remove duplicate allopnp file");
program.option("--maxHashSize", "Specify the max hash size", parseInt);

program.parse(process.argv);

var intervalId = setInterval(function() {
  console.log("Stats: Directory:" + directories.running() + "/" +
      directories.length() + "  SHA1:" + filesSHA1.running() + "/" +
      filesSHA1.length() + " count:" + filesCount);
}, 2000);

function proc() {
  if (directories.running() || filesSHA1.running()) {
    return;
  }

  clearInterval(intervalId);

  for ( var size in filesRepository) {
    // console.log("Size " + size + " bytes");
    var hashs = filesRepository[size];

    for ( var h in hashs) {
      if (h == "____count" || h == '?') {
        continue;
      }

      var files = hashs[h];
      if (files.length < 2) {
        continue;
      }

      console.log("Hash " + h);

      files.forEach(function(f) {
        console.log("  " + f);
      });

      if (program.removeAllo) {
        var keep = null;
        var sameName = true;
        files.forEach(function(f) {
          if (f.indexOf("__AF") >= 0 || f.indexOf("__AS") >= 0) {
            if (keep && keep.length > f.length) {
              return;
            }
            keep = f;
          }

          if (path.basename(f) != path.basename(files[0])) {
            sameName = false;
          }
        });
        if (!keep && sameName) {
          keep = files[0];
        }

        if (keep) {
          files.forEach(function(f) {
            if (f === keep) {
              return;
            }
            console.log("Remove " + f);
            fs.unlink(f, function(error) {
              if (error) {
                console.log("Can not remove " + f + " : " + error);
                return;
              }
            });
          });
        }
      }
    }
  }
}

directories.drain = proc;
filesSHA1.drain = proc;
