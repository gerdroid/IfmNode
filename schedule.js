var https = require('https'),
    http = require('http'),
    log4js = require('log4js')(),
    logger = log4js.getLogger("ifm"),
    jquery = require('jquery');

global.POLL_INTERVAL = 1000 * 60 * 30;

exports.schedule = [];

var queryIfmSchedule = function() {
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
  }).on('error', function() {
      console.log('could not reach IFM');
  });
}

function extractEvents(list) {
  var allEvents = [];
  var r = /<li class="eventlistmod-upcoming">([\w\W\s]*?)<\/li>/g;
  var event;
  while (event = r.exec(list)) {
    var e = jquery.trim(event[1]);
    allEvents.push({'title': extractTitle(e), 'date': extractDate(e)})
  }
  exports.schedule = allEvents;
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

exports.startServer = function() {
  queryIfmSchedule();
  setInterval(function() {
    queryIfmSchedule();
  }, POLL_INTERVAL);
}
