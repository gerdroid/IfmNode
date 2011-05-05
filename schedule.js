var https = require('https'),
    http = require('http'),
    jquery = require('jquery');

global.POLL_INTERVAL = 1000 * 60 * 30;
var schedule = [];

function queryIfmSchedule() {
  var buf = "";
  https.get({ host: 'intergalactic.fm', path: '/'}, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(d) {
      buf += d;
    }).on('end', function() {
			var schedule = /<ul class="eventlistmod-upcoming">([\w\W\s]*?)<\/ul>/;
      var eventList = schedule(buf)[1];
      extractEvents(eventList);
    });
  });
}

function extractEvents(list) {
  var allEvents = [];
  var r = /<li class="eventlistmod-upcoming">([\w\W\s]*?)<\/li>/g;
  var event;
  while (event = r.exec(list)) {
    var e = jquery.trim(event[1]);
    extractTitle(e);
    extractDate(e);
    allEvents.push({'title': extractTitle(e), 'date': extractDate(e)})
  }
  schedule = allEvents;
  console.log(allEvents);
}

function extractTitle(event) {
  var r = /.*<a.*?>([\w\W\s]*?)<\/a>/;
  var title = jquery.trim(r(event)[1]);
  return title;
}

function extractDate(event) {
  var r = /(.*?) \| (.*?) - (.*?)\n/;
  var d = Date.parse(r(event)[1]);
  return { 'day': r(event)[1], 'start': r(event)[2], 'end': r(event)[2]};
}

queryIfmSchedule();

setInterval(function() {
  queryIfmSchedule();
  }, POLL_INTERVAL);

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(JSON.stringify(schedule));
}).listen(8081);
