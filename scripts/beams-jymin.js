/**
 * This file is used in conjunction with Jymin to form the Beams Beams.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-Beams.js which includes required Jymin functions.
 */

var BEAMS_RETRY_TIMEOUT = 1e3;

/**
 * "Beams" is a singleton function, on the window, decorated as an object.
 */
var Beams = function () {

  // Once Beams is invoked, it is accessible from outside, even when minified.
  window.Beams = Beams;

  // If we've already decorated the singleton, don't do it again.
  if (Beams._ON) {
    return Beams;
  }

  //+env:debug
  log('[Beams] Initializing client.');
  //-env:debug

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpointUrl = serverUrl;

  // Until we connect, queue emissions.
  var emissions = [];

  // When a message is received, its list of callbacks can be looked up by message name.
  var callbacks = {};

  // If onReady gets called more than once, reset callbacks.
  // When used with D6, calls to "Beams.on" should be inside onReady callbacks.
  var hasRendered = false;
  onReady(function () {
    if (hasRendered) {
      callbacks = {connect: onConnect};
    }
    hasRendered = true;
  });

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  /**
   * Listen for messages from the server.
   */
  Beams._ON = Beams.on = function (name, callback) {
    //+env:debug
    log('[Beams] Listening for "' + name + '".');
    //-env:debug

    var list = callbacks[name];
    if (!list) {
      list = callbacks[name] = [];
    }
    push(list, callback);
    return Beams;
  };

  /**
   * Listen for messages from the server.
   */
  Beams._HANDLE = Beams.handle = function (name, callback) {
    //+env:debug
    log('[Beams] Listening for "' + name + '" with a singular handler.');
    //-env:debug
    callbacks[name] = [callback];
    return Beams;
  };

  /**
   * Listen for "connect" messages.
   */
  Beams._CONNECT = Beams.connect = function (callback) {
    Beams._ON('connect', callback);
    return Beams;
  };

  /**
   * Emit a message to the server via XHR POST.
   */
  Beams._EMIT = Beams.emit = function (name, data) {
    data = stringify(data || {}, 1);

    //+env:debug
    log('[Beams] Emitting "' + name + '": ' + data + '.');
    //-env:debug

    // The server can use the count for sequencing.
    n++;
    // Try to emit data to the server.
    function send() {
      getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        'd=' + escape(data),
        // On success, there's nothing we need to do.
        doNothing,
        // On failure, retry.
        function () {
          setTimeout(send, BEAMS_RETRY_TIMEOUT);
        }
      );
    }
    if (Beams.id) {
      send();
    }
    else {
      emissions.push(send);
    }
    return Beams;
  };

  /**
   * Poll for new messages.
   */
  function poll() {
    //+env:debug
    log('[Beams] Polling for messages at "' + endpointUrl + '".');
    //-env:debug
    getResponse(endpointUrl, onSuccess, onFailure);
  }

  /**
   * On success, iterate through messages, triggering events.
   */
  function onSuccess(messages) {
    forEach(messages, function (message) {
      var name = message[0];
      var data = message[1];
      triggerCallbacks(name, data);
    });
    // Poll again.
    addTimeout(Beams, poll, 0);
  }

  /**
   * On failure, log if in a debug environment, and try again later.
   */
  function onFailure(response) {
    // Try again later.
    addTimeout(Beams, poll, BEAMS_RETRY_TIMEOUT);
    //+env:debug
    error('[Beams] Failed to connect to "' + endpointUrl + '".');
    //-env:debug
  }

  /**
   * Trigger any matching callbacks with received data.
   */
  function triggerCallbacks(name, data) {
    //+env:debug
    log('[Beams] Received "' + name + '": ' + stringify(data) + '.');
    //-env:debug
    forEach(callbacks[name], function (callback) {
      if (isFunction(callback)) {
        callback.call(Beams, data);
      }
      else {
        //+env:debug
        error('[Beams] Handler for "' + name + '" is not a function: ' + stringify(callback) + '.');
        //-env:debug
      }
    });
  }

  /**
   * When we connect, set the client ID.
   */
  function onConnect(data) {
    Beams.id = data.id;
    endpointUrl = serverUrl + '?id=' + Beams.id;
    //+env:debug
    log('[Beams] Set endpoint URL to "' + endpointUrl + '".');
    //-env:debug

    // Now that we have the client ID, we can emit anything we had queued.
    forEach(emissions, function (send) {
      send();
    });
    emissions = [];
  }

  Beams._CONNECT(onConnect);

  // Start polling.
  poll();

  return Beams;
};
