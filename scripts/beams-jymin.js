/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 */

var BEAMS_RETRY_TIMEOUT = 1e3;

var getBeams = function () {

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpoint = serverUrl;

  // When a message is received, its list of callbacks can be looked up by message name.
  var callbacks = {};

  // Keep a count of emissions so the server can de-duplicate.
  var count = 0;

  // Create a client.
  var client = {

    connect: function (callback) {
      this.on('connect', callback);
      return client;
    },

    on: function (name, callback) {
      var list = callbacks[name]
      if (!list) {
        list = callbacks[name] = [];
      }
      push(list, callback);
      return client;
    },

    emit: function (name, data) {
      // The server can use the count to ignore duplicates.
      count++;
      // Try to emit data to the server.
      function send() {
        getResponse(
          // Send the event name and emission count as URL params.
          endpoint + '&name=' + escape(name) + '&count=' + count,
          // Send the message data as POST body so we're not size-limited.
          data,
          // On success, there's nothing we need to do.
          doNothing,
          // On failure, retry.
          function () {
            setTimeout(send, BEAMS_RETRY_TIMEOUT);
          }
        );
      }
      return client;
    }

  };

  // Poll for a new list of messages.
  function poll() {
    getResponse(endpoint, 0, function (messages) {
      // Iterate through the messages, triggering events.
      forEach(messages, function (message) {
        var name = message[0];
        var data = message[1];
        trigger(name, data);
      });
      // Poll again.
      poll();
    },
    function () {
      log('ERROR: Failed to connect (' + endpoint + ').');
      // Try again later.
      setTimeout(poll, BEAMS_RETRY_TIMEOUT);
    }, 1);
  };

  // Trigger any related callbacks with received data.
  function trigger(name, data) {
    forEach(callbacks[name], function (callback) {
      callback.call(client, data);
    });
  };

  // When a client connects, set the client id.
  client.connect(function (data) {
    decorateObject(client, data);
    endpoint = serverUrl + '?id=' + client.id;
  });

  poll();

  return client;
};
