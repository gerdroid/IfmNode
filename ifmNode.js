var net = require('net'),
    https = require('https'),
    jquery = require('jquery');
    log4js = require('log4js')(),
    logger = log4js.getLogger("ifm");
    http = require('http');

global.WEB = 8080;
global.PORT = 8142;
global.POLL_INTERVAL = 20000;
global.MAX_BUFFER_SIZE = 1024;

var NUMBER_OF_CHANNELS = 3;
var clientNumber = 0;
var clients = [];
var trackInfos = new Array(NUMBER_OF_CHANNELS);
trackInfos = jquery.map(trackInfos, function(v) { return { "path": "", "track": "", "label": ""} });

var server = net.createServer(function(socket) {
  socket.setNoDelay(true);
  setupClient(socket, clientNumber);
  clientNumber++;
});

function setupClient(socket, number) {
  socket.on('connect', function() {
    clients.push(socket);
    logger.info('client ' + number + ', opened connection. ' + clients.length + ' connections open.');
    for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
      pushToClients(i, trackInfos[i]);
    }
  });
  socket.once('end', function() {
    var idx = clients.indexOf(socket);
    if (idx != -1) clients.splice(idx, 1);
    logger.info('client ' + number + ', closed connection. ' + clients.length + ' connections open.');
  });
  socket.once('error', function() {
    var idx = clients.indexOf(socket);
    if (idx != -1) clients.splice(idx, 1);
    logger.info('client ' + number + ', connection was aborted. ' + clients.length + ' connections open.');
  });
}

server.listen(PORT);
logger.info("server started...accept conections");

function queryIfm(channel, callback) {
  https.get({ host: 'intergalactic.fm', path: '/blackhole/homepage.php?channel=' + (channel+1)}, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(d) {
      var path = /.*img src="(.*?)".*/(d)[1];
      var track = /.*<div id="track-info-trackname">\s*<.*?>(.*?)<\/a>.*/(d)[1];
      var label = /.*<div id="track-info-label">(.*?)<\/div>.*/(d)[1];
      var info =  { "path": path , "track": track, "label": label };
      callback(channel, info);
    });
  }).on('error', function(e) {
    logger.error(e.message);
  });
}

setInterval(function() {
  for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
    queryIfm(i, function(index, info) {
      if (info.track != trackInfos[index].track) {
        pushToClients(index, info);
        trackInfos[index] = info;
      }
    });
  }
}, POLL_INTERVAL);

function pushToClients(channelIndex, info) {
  var clientUpdate = { "channel": channelIndex, "infos": info};
  jquery.each(clients, function(index, socket) {
   if (socket.bufferSize > MAX_BUFFER_SIZE) {
      logger.info("closing socket to dead client");
      socket.end();
    } else {
      socket.write(JSON.stringify(clientUpdate) + "\n");
    }
  });
}

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  var text = "open connections: " + clients.length + "\n\n";
  jquery.each(clients, function(index, socket) {
    text = text + index + ": " + socket.remoteAddress + "\n";
  });
  res.end(text);
}).listen(WEB);

