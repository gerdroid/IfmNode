var net = require('net'),
    jquery = require('jquery'),
    log4js = require('log4js')(),
    logger = log4js.getLogger("ifm");

(function() {
  clientNumber = 0;
  exports.createPushServer = function(port, onConnected) {
    var clients = [];
    net.createServer(function(socket) {
      socket.setNoDelay(true);
      setupClient(socket, clientNumber);
      clientNumber++;
    }).listen(port);

    function setupClient(socket, number) {
      socket.on('connect', function() {
        clients.push(socket);
        if (onConnected !== undefined) onConnected(server);
        logger.info('client ' + number + ', opened connection. ' + clients.length + ' connections open');
      });
      socket.once('end', function() {
        var idx = clients.indexOf(socket);
        if (idx != -1) clients.splice(idx, 1);
        logger.info('client ' + number + ', closed connection. ' + clients.length + ' connections open');
      });
      socket.once('error', function() {
        var idx = clients.indexOf(socket);
        if (idx != -1) clients.splice(idx, 1);
        logger.info('client ' + number + ', aborted connection. ' + clients.length + ' connections open');
      });
    }
    
    var server = {
      each: function(action) {
        jquery.each(clients, function(index, socket) {
          if (socket.bufferSize > MAX_BUFFER_SIZE) {
            logger.info("closing socket to dead client");
            socket.end();
          } else {
            action(socket);
          }
        });
      },
      getConnections: function() {
        return clients.length;
      }
    }
    return server;
  }
})();
