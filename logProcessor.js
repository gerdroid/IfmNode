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

var totalTime = {
  sum: 0,
  process: function(start, end) {
    // duration in minutes
    var duration = (end.date - start.date) / 60000;
    this.sum += duration;
  },

  end: function() {
    console.log(this.sum);
  }
};

var totalConnections = {
  sum: 0,
  process: function(start, end) {
    var h = start.date.getHours();
    console.log(h);
    this.sum++;
  },

  end: function() {
    console.log(this.sum);
  }
};

var connectionsPerHour = {
  sum: 0,
  process: function(start, end) {
    var h = start.date.getHours();
    console.log(h);
    this.sum++;
  },

  end: function() {
    console.log(this.sum);
  }
};

processLog('ifm.log', totalTime);
processLog('ifm.log', totalConnections);

