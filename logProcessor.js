var lines=require("lines-adapter");
var log4js = require('log4js')();
var logger = log4js.getLogger("ifm");
var fs=require('fs');
var jquery=require('jquery');

var parse = function(line) {
  var d = /\[(.*?)\].*/(line);
  var date = "";
  if (d !== null) {
    date = d[1];
  }
  var c = /.*- client (.*?), (.*?) connection*./(line);
  if (c !== null) {
    return {date: new Date(date), idx: c[1], action: c[2]}
  } else {
    var a = /.*- server started...accept conections*./(line);
    if (a !== null) {
      return {date: new Date(date), action: 'reset'}
    }
  }
  return "";
}

exports.processLog = function(logFile, callback) {
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

exports.totalConnections = function(callback) {
  var sum = 0;
  return {
    process: function(start, end) {
      sum++;
    },

    end: function() {
      callback(sum);
    }
  };
}

exports.totalTime = function() {
  var sum = 0;
  return {
    process: function(start, end) {
      // duration in minutes
      var duration = (end.date - start.date) / 60000;
      sum += duration;
    },

    end: function() {
      console.log(sum);
    }
  };
}

exports.connectionsPerTime = function(callback, timeInterval) {
  var connections = [];
  return {
    process: function(start, end) {
      connections.push(start.date.getTime());
    },
    end: function() {
      connections.sort(function(a, b) {
        return a - b;
      });
      var startTime = connections[0];
      var normalized = connections.map(function(x) {
        return x - startTime;
      });
      var interval = 1000 * timeInterval;
      var i = 0;
      var intervalCounter = 0;
      var res = [];
      while (i < normalized.length) {
        var t = intervalCounter * interval;
        var c = 0;
        while ((i < normalized.length) && (normalized[i] < t)) {
          i++;
          c++;
        }
        var timeStamp = intervalCounter * interval + startTime;
        res[intervalCounter] = [timeStamp, c];
        intervalCounter++;
      }
      callback(res);
    }
  };
}

exports.connectionTime = function(callback, timeInterval, scaleFactor) {
  var connections = [];
  return {
    process: function(start, end) {
      var item = [start.date.getTime(), end.date.getTime() - start.date.getTime()];
      connections.push(item);
    },
    end: function() {
      connections.sort(function(a, b) {
        return a[0] - b[0];
      });
      var startTime = connections[0][0];
      var normalized = connections.map(function(x) {
        return [x[0] - startTime, x[1]];
      });
      var interval = 1000 * timeInterval;
      var i = 0;
      var intervalCounter = 0;
      var res = [];
      while (i < normalized.length) {
        var t = intervalCounter * interval;
        var c = 0;
        while ((i < normalized.length) && (normalized[i][0] < t)) {
          c = c + normalized[i][1];
          i++;
        }
        var timeStamp = intervalCounter * interval + startTime;
        res[intervalCounter] = [timeStamp, c / scaleFactor];
        intervalCounter++;
      }
      callback(res);
    }
  };
}
