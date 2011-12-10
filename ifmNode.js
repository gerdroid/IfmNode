var https = require('https'),
    os = require('os'),
    jquery = require('jquery'),
    log4js = require('log4js')(),
    logger = log4js.getLogger("ifm"),
    http = require('http'),
    url = require('url'),
    ifmSchedule = require('./schedule'),
    pushServer = require('./pushServer'),
    static = require('node-static'),
    logProcessor = require('./logProcessor');

global.WEB = 8080;
global.LEGACY_PUSH_PORT = 8142;
global.TRIGGER_PORT = 8143;
global.POLL_INTERVAL = 20000;
global.MAX_BUFFER_SIZE = 1024;

var NUMBER_OF_CHANNELS = 4;
var trackInfos = new Array(NUMBER_OF_CHANNELS);
trackInfos = jquery.map(trackInfos, function(v) { return { "path": "", "track": "", "label": "", "rating": "", "votes": ""} });
var streamLocations = new Array(NUMBER_OF_CHANNELS);
streamLocations = jquery.map(streamLocations, function(v) { return "undefined" });

var legacyServer = pushServer.createPushServer(LEGACY_PUSH_PORT, function(server) {
  var str = "";
  for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
    var update = { "channel": i, "infos": trackInfos[i] };
    str += JSON.stringify(update) + "\n";
  }
  server.each(function(socket) {
    socket.write(str);
  })
});

var triggerServer = pushServer.createPushServer(TRIGGER_PORT);

(function() {
  function queryAll() {
    https.get({ host: 'intergalactic.fm', path: '/blackhole/newhomepage.php?format=json'}, function(res) {
      res.setEncoding('utf8');
      res.on('data', function(d) {
        var allChannels = JSON.parse(d);
        for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
          var channel = allChannels[(i+1).toString()];
          var path = "/data/covers/" + channel.coverart;
          var track = channel.artist + " - " + channel.track;
          var label = channel.label;
          var rating = 0;
          var numberOfRatings = 0;
          var info =  { "path": path , "track": track, "label": label, "rating": rating, "votes": numberOfRatings};
          logger.info("------>" + JSON.stringify(info));
          if (info.track != trackInfos[i].track) {
            trackInfos[i] = info;
            var update = { "channel": i, "infos": info };
            legacyServer.each(function(socket) {
              socket.write(JSON.stringify(update) + "\n");
            });
            triggerServer.each(function(socket) {
              socket.write(JSON.stringify({"update": [index]}) + "\n");
            });
          }
        } 
      });
    }).on('error', function(e) {
      logger.error(e.message);
    });
  }

  queryAll();
  setInterval(function() {
    queryAll();
  }, POLL_INTERVAL);
})();

(function() {
  function queryStreamLocation() {
    for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
      var request = function(channel) {
        http.get({ host: 'radio.intergalacticfm.com', path: '/' + (i+1) + '.m3u'}, function(res) {
          res.setEncoding('utf8');
          res.on('data', function(d) {
            streamLocations[channel] = jquery.trim(d);
          });
        }).on('error', function(e) {
          logger.error(e.message);
        });
      }
      request(i);
    }
  }
  
  queryStreamLocation();
  setInterval(function() {
    queryStreamLocation();
    }, 1000 * 60 * 10);
})();

(function() {
  var fileServer = new(static.Server)('./www');
  http.createServer(function (req, res) {
    var path = url.parse(req.url).pathname;
    if (path == '/upcoming') {
      sendAsJSON(res, ifmSchedule.schedule);
    } else if (path.substring(0, '/channelinfo'.length) === '/channelinfo')  {
      var match = /\/channelinfo\/(.)/(path);
      if (match != null) {
        var channel = parseInt(match[1]) - 1;
        if ((channel >= 0) && (channel < NUMBER_OF_CHANNELS)) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(trackInfos[channel]));
        } else {
          res.writeHead(404, "channel does not exist");
          res.end();
        }
      } else {
        res.end(JSON.stringify(trackInfos));
      }
    } else if (path == '/streamlocations') {
      sendAsJSON(res, streamLocations);
    } else if (path == '/stats/live') {
      var text = "open connections: " + legacyServer.getConnections() + "\n\n";
      var index = 0;
      legacyServer.each(function(socket) {
        text = text + index + ": " + socket.remoteAddress + "\n";
        index++;
      });
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(text);
    } else if (path == '/stats/connectionTime') {
      var interval = parseInt(url.parse(req.url, true).query.interval);
      var scale = parseInt(url.parse(req.url, true).query.scale);
      logProcessor.processLog('ifm.log', logProcessor.connectionTime(function(conPerHour) {
        sendAsJSON(res, conPerHour);
      }, interval, scale));
    } else if (path == '/stats/connections') {
      var interval = parseInt(url.parse(req.url, true).query.interval);
      logProcessor.processLog('ifm.log', logProcessor.connectionsPerTime(function(conPerHour) {
        sendAsJSON(res, conPerHour);
      }, interval));
    } else {
      req.on('end', function() {
        logger.info('serve static fileServer');
        fileServer.serve(req, res);
      });
    } 
  }).listen(WEB);

  function sendAsJSON(res, str) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(str));
  }
})();

//ifmSchedule.startServer();
logger.info("server started...accept conections");

