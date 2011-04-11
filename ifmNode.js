var net = require('net'),
    https = require('https'),
    jquery = require('jquery');

var NUMBER_OF_CHANNELS = 3;
var clients = [];
var empty = { "path": "", "track": "", "label": ""};
var trackInfos = new Array(NUMBER_OF_CHANNELS);
trackInfos = jquery.map(trackInfos, function(v) { return { "path": "", "track": "", "label": ""} });

var server = net.createServer(function(socket) {
  console.log("hossa");
  clients.push(socket);
  socket.on('connect', function() {
    for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
      pushToClients(i, trackInfos[i]);
    }
  });
  socket.once('end', function() {
    var idx = clients.indexOf(socket);
    if (idx != -1) clients.splice(idx, 1);
    console.log("aus und vorbei....");
  })
}).listen(8124, "localhost");

console.log("server started...accept conections");

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
    console.log("Got error: " + e.message);
  });
}

setInterval(function() {
  for (var i=0; i<NUMBER_OF_CHANNELS; i++) {
    queryIfm(i, function(index, info) {
      if (info.track != trackInfos[index].track) {
        pushToClients(index, info);
        trackInfos[index] = info;
        //console.log(JSON.stringify(info));
      }
    });
  }
}, 10000);

function pushToClients(channelIndex, info) {
  var clientUpdate = { "channel": channelIndex, "infos": info};
  console.log(clientUpdate);
  jquery.each(clients, function(index, socket) {
    socket.write(JSON.stringify(clientUpdate));
  });
}
