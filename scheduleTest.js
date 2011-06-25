var ifmSchedule = require('./schedule');

console.log("wtf");
ifmSchedule.startServer();

setInterval(function() {
  console.log(ifmSchedule.schedule);
  }, 1000);
