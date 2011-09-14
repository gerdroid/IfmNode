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

var NUMBER_OF_CHANNELS = 3;
var trackInfos = new Array(NUMBER_OF_CHANNELS);
trackInfos = jquery.map(trackInfos, function(v) { return { "path": "", "track": "", "label": "", "rating": "", "votes": ""} });

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
  function queryIfm(channel, callback) {
    https.get({ host: 'intergalactic.fm', path: '/blackhole/homepage.php?channel=' + (channel+1)}, function(res) {
      res.setEncoding('utf8');
      res.on('data', function(d) {
        var path = /.*img src="(.*?)".*/(d)[1];
        var track = /.*<div id="track-info-trackname">\s*<.*?>(.*?)<\/a>.*/(d)[1];
        var label = /.*<div id="track-info-label">(.*?)<\/div>.*/(d)[1];
        var rating = 0;
        var numberOfRatings = 0;
        if (d.search(/not yet rated.*/) == -1) {
          ratingInfo = /.*rating: (.*?)<\/form>.*/(d)[1];
          rating = /(.*?)\/.*/(ratingInfo)[1];
          numberOfRatings = /.*\((.*) votes\).*/(ratingInfo)[1];
        }
        var info =  { "path": path , "track": track, "label": label, "rating": rating, "votes": numberOfRatings};
        callback(channel, info);
      });
    }).on('error', function(e) {
      logger.error(e.message);
    });
  }
    
  (function monitorChannels() {
    function queryAll() {
      for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
        queryIfm(i, function(index, info) {
          if (info.track != trackInfos[index].track) {
            trackInfos[index] = info;
            var update = { "channel": index, "infos": info };
            legacyServer.each(function(socket) {
              socket.write(JSON.stringify(update) + "\n");
            });
            triggerServer.each(function(socket) {
              socket.write(JSON.stringify({"update": [index]}) + "\n");
            });
          }
        });
      }
    }

    queryAll();
    setInterval(function() {
      queryAll();
    }, POLL_INTERVAL);
  })();
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

ifmSchedule.startServer();
logger.info("server started...accept conections");

