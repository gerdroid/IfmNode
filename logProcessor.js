var lines=require("lines-adapter");
var fs=require('fs');
var jquery=require('jquery');


var parse = function(line) {
  var d = /\[(.*?)\].*/(line)[1];
  var c = /.*- client (.*?), (.*?) connection*./(line);
  if (c !== null) {
    return {date: new Date(d), idx: c[1], action: c[2]}
  } else {
    var a = /.*- server started...accept conections*./(line);
    if (a !== null) {
      return {date: new Date(d), action: 'reset'}
    }
  }
  return "";
}

var processLog = function(logFile, callback) {
  var openConnections = {};
  lines(fs.createReadStream(logFile), 'utf8').on('data',
    function(line) {
      var logEntry = parse(line);
      if (logEntry.action === 'opened') {
        openConnections[logEntry.idx] = logEntry;
      } else if (logEntry.action == 'closed') {
        var idx = logEntry.idx;
        callback.process(openConnections[idx], logEntry);
        delete openConnections[idx];
      } else if (logEntry.action === 'reset') {
        openConnections = {};
      }
    }).on('end',
      function() {
        callback.end();   // invoked at the end of stream
      });
}

var logProcessor = {
  sum: 0,
  process: function(start, end) {
    var duration = (end.date - start.date) / 1000;
    this.sum += duration;
  },

  end: function() {
    console.log(this.sum);
  }
};

processLog('ifm.log', logProcessor);

