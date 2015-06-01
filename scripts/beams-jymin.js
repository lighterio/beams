/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 *
 * @use jymin/jymin.js
 */

var Beams = (function () {

  //+env:debug
  Jymin.log('[Beams] Initializing client.');
  //-env:debug

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = (window._href || '') + '/beam';
  var endpointUrl = serverUrl;
  var retryMin = 1e3;
  var retryMax = 6e4;
  var retryTimeout = retryMin;
  var retryBackoff = 2;

  // Until we connect, queue emissions.
  var emissions = [];

  // The Beams object is an event emitter.
  var Beams = new Jymin.Emitter();

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  // When we receive something from the server, emit it internally.
  Beams._receive = Beams._emit;

  /**
   * Emit a message to the server via XHR POST.
   */
  Beams._emit = function (name, data) {
    data = Jymin.stringify(data || {});

    //+env:debug
    Jymin.log('[Beams] Emitting "' + name + '": ' + data + '.');
    //-env:debug

    // The server can use the count for sequencing.
    n++;

    // Try to emit data to the server.
    function send() {
      Jymin.getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + Jymin.escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        'd=' + Jymin.escape(data),
        // On success, there's nothing we need to do.
        function () {
          retryTimeout = retryMin;
        },
        // On failure, retry.
        function () {
          retryTimeout = Math.min(retryTimeout * retryBackoff, retryMax);
          setTimeout(send, retryTimeout);
        }
      );
    }

    if (Beams._id) {
      send();
    }
    else {
      emissions.push(send);
    }
    return Beams;
  };

  /**
   * When we connect, set the client ID.
   */
  Beams._on('connect', function (data) {
    Beams._id = data.id;
    endpointUrl = serverUrl + '?id=' + Beams._id;
    //+env:debug
    Jymin.log('[Beams] Set endpoint URL to "' + endpointUrl + '".');
    //-env:debug

    // Now that we have the client ID, we can emit anything we had queued.
    Jymin.forEach(emissions, function (send) {
      // TODO: Send queued data in a single request.
      send();
    });
    emissions = [];
  });

  /**
   * Poll for new messages.
   */
  function poll() {
    //+env:debug
    Jymin.log('[Beams] Polling for messages at "' + endpointUrl + '".');
    //-env:debug
    Jymin.getResponse(endpointUrl, onSuccess, onFailure);
  }

  /**
   * On success, iterate through messages, triggering events.
   */
  function onSuccess(messages) {
    retryTimeout = retryMin;
    Jymin.forEach(messages, function (parts) {
      var name = parts[0];
      var data = parts[1];
      Beams._receive(name, data);
    });
    // Start polling again.
    Jymin.setTimer(Beams, poll, 0);
  }

  /**
   * On failure, log if in a debug environment, and try again later.
   */
  function onFailure() {
    // Try again later.
    retryTimeout = Math.min(retryTimeout * retryBackoff, retryMax);
    Jymin.setTimer(Beams, poll, retryTimeout);
    //+env:debug
    Jymin.error('[Beams] Failed to connect to "' + endpointUrl + '".');
    //-env:debug
  }

  // Start polling.
  poll();

  return Beams;

})();
