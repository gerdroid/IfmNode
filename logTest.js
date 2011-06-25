var assert = require('assert');

var logProcessor = require('./logProcessor')

//logProcessor.processLog('test.log', logProcessor.totalTime());
logProcessor.processLog('test.log', logProcessor.totalConnections(function(total) {
  assert.equal(total, 6);
}));

logProcessor.processLog('test.log', logProcessor.connectionsPerHour(function(conPerHour) {
  console.log(conPerHour);
}));


