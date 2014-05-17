/**
 * Create a new client.
 */
var Client = module.exports = function Client(request, response) {
	// TODO: Expand the ID character set to make "tiny" IDs.
	this.id = 'B' + Math.floor(Math.random() * 1e15);
	this.buffer = '';
	this.callbacks = {};
	this.wait(request, response);
	this.emit('connect', {id: this.id});
};

/**
 * Set a timeout to restart polling.
 */
Client.prototype.resetTimeout = function () {
	var client = this;
	var duration = require('../beams')._pollDuration;
	clearTimeout(client.timeout);
	client.timeout = setTimeout(function () {
		client.emit('timeout', duration);
	}, duration);
}

/**
 * Wait for messages.
 */
Client.prototype.wait = function (request, response) {
	this.request = request;
	this.response = response;
	this.resetTimeout();
	if (this.buffer) {
		this.emit();
	}
};

/**
 * Disconnect the client.
 */
Client.prototype.disconnect = function () {
	this.request = this.response = null;
};

/**
 * Emit a message with some data.
 */
Client.prototype.emit = function (name, data) {
	// If there's a new emission, add it to the buffer.
	if (name) {
		this.buffer += (this.buffer ? ',' : '');
		this.buffer += JSON.stringify([name, data]);
	}
	// If we can send the buffer, send it now.
	// Otherwise, it will be sent when we reconnect.
  var response = this.response;
	if (response) {
    if (!response._header) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/json');
    }
		response.end('[' + this.buffer + ']');
		this.buffer = '';
		this.disconnect();
	}
};
