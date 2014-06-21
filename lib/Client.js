var reserved = /^(break|case|catch|continue|debugger|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|this|throw|try|typeof|var|void|while|with)$/;

/**
 * Generate non-strict JSON that clients can eval.
 */
function stringify(data, stack) {
  if (data === null) {
    data = 'null';
  }
  else if (typeof data == 'function') {
    data = ('' + data).replace(/^function \(/, 'function(');
  }
  else if (data instanceof Date) {
    data = 'new Date(' + data.getTime() + ')';
  }
  else if (typeof data == 'object') {
    stack = stack || [];
    var isCircular = false;
    stack.forEach(function (item, index) {
      if (item == data) {
        isCircular = true;
      }
    });
    if (isCircular) {
      return null;
    }
    stack.push(data);
    var parts = [];
    var before, after;
    if (data instanceof Array) {
      before = '[';
      after = ']';
      data.forEach(function (value) {
        parts.push(stringify(value, stack));
      });
    }
    else {
      before = '{';
      after = '}';
      for (var key in data) {
        if (reserved.test(key)) {
          key = '"' + key + '"';
        }
        var value = data[key];
        parts.push(key + ':' + stringify(value, stack));
      }
    }
    stack.pop();
    data = before + parts.join(',') + after;
  }
  else if (typeof data == 'string') {
    data = '"' + data.replace(/"/g, '\\"') + '"';
  }
  else {
    data = '' + data;
  }
  return data;
}

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
  var duration = require('../beams').pollTimeout;
  clearTimeout(client.timeout);
  client.timeout = setTimeout(function () {
    client.emit('timeout', duration);
  }, duration);
};

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
    this.buffer += stringify([name, data]);
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
