/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 */

var BEAMS_RETRY_TIMEOUT = 1e3;

var Beams = function () {

  // If we've already created a client, use it.
  var client = Beams._CLIENT;
  if (client) {
    return client;
  }

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpointUrl = serverUrl;

  // Until we connect, queue emissions.
  var emissions = [];

  // When a message is received, its list of callbacks can be looked up by message name.
  var callbacks = {};

  // If onReady gets called more than once, reset callbacks.
  // When used with D6, calls to "client.on" should be inside onReady callbacks.
  var hasRendered = false;
  onReady(function () {
    if (hasRendered) {
      callbacks = {};
    }
    hasRendered = true;
  });

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  // Create a client.
  client = Beams._CLIENT = {};

  client._CONNECT = client.connect = function (callback) {
    this._ON('connect', callback);
    return client;
  };

  client._ON = client.on = function (name, callback) {
    var list = callbacks[name]
    if (!list) {
      list = callbacks[name] = [];
    }
    push(list, callback);
    return client;
  };

  client._EMIT = client.emit = function (name, data) {
    // The server can use the count to ignore duplicates.
    n++;
    // Try to emit data to the server.
    function send() {
      getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        data || {},
        // On success, there's nothing we need to do.
        doNothing,
        // On failure, retry.
        function () {
          setTimeout(send, BEAMS_RETRY_TIMEOUT);
        }
      );
    }
    if (client.id) {
      send();
    }
    else {
      emissions.push(send);
    }
    return client;
  };

  // Poll for a new list of messages.
  function poll() {
    getResponse(endpointUrl, 0, function (messages) {
      // Iterate through the messages, triggering events.
      forEach(messages, function (message) {
        var name = message[0];
        var data = message[1];
        trigger(name, data);
      });
      // Poll again.
      poll();
    },
    function (response) {
      log('ERROR: Failed to connect (' + endpointUrl + ').');
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
  client._CONNECT(function (data) {
    decorateObject(client, data);
    endpointUrl = serverUrl + '?id=' + client.id;

    // Now that we have the client ID, we can emit anything we queued.
    emissions.forEach(function (send) {
      send();
    });
    emissions = [];
  });

  poll();

  return client;
};
