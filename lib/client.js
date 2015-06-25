var Type = require('../common/object/type')
var stringify = require('../common/json/scriptify')

module.exports = Type.extend({

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
    var client = this
    var duration = require('../beams').pollTimeout
    clearTimeout(client.timeout)
    client.timeout = setTimeout(function () {
      client.emit('timeout', duration)
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
