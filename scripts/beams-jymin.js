/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 *
 * @use jymin/jymin.js
 */

// The Beams object can drop out if it's not used.
var Beams = {}

// The beams server listens for GET and POST requests at /beam.
Beams.serverUrl = (window._href || '') + '/beam'
Beams.endpointUrl = Beams.serverUrl

// On disconnect, start retrying once a second, and back off to once a minute.
Beams.retryMin = 1e3
Beams.retryMax = 6e4
Beams.retryBackoff = 2
Beams.retryTimeout = Beams.retryMin

// Until we connect, queue emissions.
Beams.emissions = []

// Keep a count of emissions so the server can de-duplicate.
Beams.emissionNumber = 0

/**
 * Emit a message to the server via XHR POST.
 */
Beams.emit = function (name, data) {
  data = Jymin.stringify(data || {})

  //+env:debug
  Jymin.log('[Beams] Emitting "' + name + '": ' + data + '.')
  //-env:debug

  // The server can use the count for sequencing.
  Beams.emissionNumber++

  // Try to emit data to the server.
  function send () {
    Jymin.getResponse(
      // Send the event name and emission number as URL params.
      Beams.endpointUrl + '&m=' + Jymin.escape(name) + '&n=' + Beams.emissionNumber,
      // Send the message data as POST body so we're not size-limited.
      'd=' + Jymin.escape(data),
      // On success, there's nothing we need to do.
      function () {
        Beams.retryTimeout = Beams.retryMin
      },
      // On failure, retry.
      function () {
        Beams.retryTimeout = Math.min(Beams.retryTimeout * Beams.retryBackoff, Beams.retryMax)
        setTimeout(send, Beams.retryTimeout)
      }
    )
  }

  if (Beams.id) {
    send()
  } else {
    Beams.emissions.push(send)
  }
  return Beams
}

/**
 * Accept event handlers, and run them through Jymin.
 *
 * @param  {String}   type  Type of event to handle.
 * @param  {Function} fn    Handler for that type of event.
 */
Beams.on = function (type, fn) {
  Jymin.on(Beams, type, function (element, event) {
    fn(event.data)
  })
  return Beams
}

/**
 * When we connect, set the client ID.
 */
Beams.on('connect', function (data) {
  Beams.id = data.id
  Beams.endpointUrl = Beams.serverUrl + '?id=' + Beams.id
  //+env:debug
  Jymin.log('[Beams] Set endpoint URL to "' + Beams.endpointUrl + '".')
  //-env:debug

  // Now that we have the client ID, we can emit anything we had queued.
  Jymin.forEach(Beams.emissions, function (send) {
    // TODO: Send queued data in a single request.
    send()
  })
  Beams.emissions = []
})

/**
 * Allow clients to submit log messages to the server.
 *
 * @param  {Object} data  The data to log
 */
Beams.log = function (data) {
  if (data) {
    Beams.emit('log', data)
  }
  return Beams
}

/**
 * Poll for new messages.
 */
Beams.poll = function () {
  //+env:debug
  Jymin.log('[Beams] Polling for messages at "' + Beams.endpointUrl + '".')
  //-env:debug
  Jymin.getResponse(Beams.endpointUrl, Beams.onSuccess, Beams.onFailure)
}

/**
 * On success, iterate through messages, triggering events.
 */
Beams.onSuccess = function (messages) {

  // Reset to the minimum retry delay.
  Beams.retryTimeout = Beams.retryMin

  // Trigger events for all messages received from the server.
  Jymin.forEach(messages, function (parts) {
    var type = parts[0]
    var data = parts[1]
    Jymin.trigger(Beams, {type: type, data: data})
  })

  // Start polling again.
  Jymin.setTimer(Beams, Beams.poll, 0)

  // Signal that Beams is still working.
  Jymin.trigger(Beams, 'success')
}

/**
 * On failure, log if in a debug environment, and try again later.
 */
Beams.onFailure = function () {
  //+env:debug
  Jymin.error('[Beams] Failed to connect to "' + Beams.endpointUrl + '".')
  //-env:debug

  // Try again later.
  var max = Beams.retryMax
  var backed = Beams.retryTimeout * Beams.retryBackoff
  Beams.retryTimeout = Math.min(backed, max)
  Jymin.setTimer(Beams, Beams.poll, Beams.retryTimeout)

  // Signal that Beams is not working at the moment.
  Jymin.trigger(Beams, 'failure')
}

// When the page unloads, tell the server to remove this client.
Jymin.on(window, 'beforeunload', function () {
  Beams.emit('unload')
})

// Start polling.
Beams.poll()

// Allow the server to tell clients to reload themselves.
Beams.on('reload', function () {
  location.reload()
})
