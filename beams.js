var Type = require('lighter-type')
var stringify = require('lighter-json').scriptify

// TODO: Scale to many servers.
var beams = module.exports = function () {
  return beams
}

// We can iterate over Beams clients.
beams.clients = {}

// Store message handlers as arrays keyed by message name.
beams.handlers = {}

// After 30 seconds, make a client reconnect.
beams.pollTimeout = 3e4

// Default to console logging.
beams.log = console

/**
 * Set a logger that exposes "log", "info", "error" and "warn".
 */
beams.setLog = function (log) {
  beams.log = log
}

/**
 * Accept an Express-like server and make it a Beams server as well.
 */
beams.setServer = function (server) {
  /**
   * Accept a client's long polling request.
   */
  server.get('/beam', function (request, response) {
    getClient(request, response)
  })

  /**
   * Receive data from a client, and trigger callbacks.
   */
  server.post('/beam', function (request, response) {
    var query = request.query
    var body = request.body
    var data = body ? body.d : null
    var clientId = query.id
    var client = beams.clients[clientId]
    var messageName = query.m
    var emissionNumber = query.n
    var callbacks = beams.handlers[messageName]
    if (data) {
      try {
        data = JSON.parse(data)
      } catch (e) {
        // Couldn't parse, so call with exactly what we received.
      }
    }
    if (callbacks) {
      callbacks.forEach(function (callback) {
        callback.call(beams, data, client, emissionNumber)
      })
    }
    // So long, and thanks for all the data.
    response.statusCode = 200
    response.setHeader('access-control-allow-origin', '*')
    response.setHeader('content-type', 'text/json')
    response.end('{received: true}')
  })
  return beams
}

/**
 * Get the client based on the request.
 * If it must be created, set the client ID in the response.
 */
function getClient (request, response) {
  var id = request.query.id
  var client = beams.clients[id]

  // If the client already exists, wait for data to send to it.
  if (client) {
    client.last = Date.now()
    client.wait(request, response)

  // If the client doesn't exist, create it.
  } else {
    do {
      client = new Client(request, response, beams)
      id = client.id
      // Ensure that its ID is unique.
    } while (beams.clients[id])

    // Add the client to our collection.
    beams.clients[id] = client

    // If there's something to run on connect, run it.
    if (beams.handlers.connect) {
      beams.handlers.connect.forEach(function (callback) {
        callback.call(client, client)
      })
    }
  }
  return client
}

/**
 * Run a callback when a client connects.
 */
beams.connect = function (callback) {
  beams.on('connect', callback)
  return beams
}

/**
 * Listen for a message by name.
 */
beams.on = function (messageName, callback) {
  var callbacks = beams.handlers[messageName]
  if (!callbacks) {
    callbacks = beams.handlers[messageName] = []
  }
  callbacks.push(callback)
  return beams
}

/**
 * Apply a singular handler for a message by name.
 */
beams.handle = function (messageName, callback) {
  beams.handlers[messageName] = [callback]
  return beams
}

/**
 * Emit data to each client.
 */
beams.emit = function (name, data) {
  beams.each(function (client) {
    client.emit(name, data)
  })
  return beams
}

/**
 * Run a callback on each client.
 */
beams.each = function (callback) {
  var clients = beams.clients
  for (var id in clients) {
    callback(clients[id])
  }
  return beams
}

/**
 * Allow clients to log to the server.
 */
beams.on('log', function (data) {
  if (typeof data === 'string') {
    data = data.replace(/file:\/\/\/android_asset\//g, process.cwd() + '/platforms/android/assets/')
    data = data.replace(/\bhttp:\/\/[^\/]*/g, '')
  }
  if (/^Error:/.test(data)) {
    beams.log.error(data)
  } else {
    beams.log.log(data)
  }
})

/**
 * Allow clients to remove themselves from the server.
 */
beams.on('unload', function (data, client) {
  client = client || 0
  var id = client.id || 0
  var platform = client.platform || 'web'
  beams.log.warn('Unloading ' + platform + ' client ' + id)
  delete beams.clients[id]
})

/**
 * Expose the paths to Beams's front-end scripts.
 */
beams.cute = __dirname + '/scripts/beams-cute.js'
beams.client = __dirname + '/beams-client.js'
beams.clientMin = __dirname + '/beams-client.min.js'

/**
 * A Client object gets instantiated for each client that connects.
 */
var Client = Type.extend({

  /**
   * Create a new client.
   */
  init: function (request, response) {
    this.id = 'B' + (Math.random() * 1e18).toString(36)
    this.buffer = ''
    this.callbacks = {}
    this.wait(request, response)
    this.emit('connect', {id: this.id})
  },

  /**
   * Set a timeout to restart polling.
   */
  resetTimeout: function () {
    var self = this
    var duration = require('../beams').pollTimeout
    clearTimeout(this.timeout)
    this.timeout = setTimeout(function () {
      self.emit('timeout', duration)
    }, duration)
  },

  /**
   * Wait for messages.
   */
  wait: function (request, response) {
    this.request = request
    this.response = response
    this.resetTimeout()
    if (this.buffer) {
      this.emit()
    }
  },

  /**
   * Emit a message with some data.
   */
  emit: function (name, data) {
    // If there's a new emission, add it to the buffer.
    if (name) {
      this.buffer += (this.buffer ? ',' : '') + stringify([name, data])
    }
    // If we can send the buffer, send it now.
    // Otherwise, it will be sent when we reconnect.
    var response = this.response
    if (response) {
      if (!response._header) {
        response.statusCode = 200
        response.setHeader('content-type', 'application/json')
        response.setHeader('access-control-allow-origin', '*')
      }
      response.end('[' + this.buffer + ']')
      this.buffer = ''
      this.disconnect()
    }
  },

  /**
   * Disconnect the client.
   */
  disconnect: function () {
    this.request = this.response = null
  }

})
