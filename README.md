# Beams

[![NPM Version](https://img.shields.io/npm/v/beams.svg) ![Downloads](https://img.shields.io/npm/dm/beams.svg)](https://npmjs.org/package/beams)
[![Build Status](https://img.shields.io/travis/lighterio/beams.svg)](https://travis-ci.org/lighterio/beams)
[![Code Coverage](https://img.shields.io/coveralls/lighterio/beams/master.svg)](https://coveralls.io/r/lighterio/beams)
[![Dependencies](https://img.shields.io/david/lighterio/beams.svg)](https://david-dm.org/lighterio/beams)
[![Support](https://img.shields.io/gratipay/Lighter.io.svg)](https://gratipay.com/Lighter.io/)

Beams is a long-polling Node.js server extension and client library.

## Getting started

Here's a simple chat server and client:

```javascript
var server = require('express')();
server.listen(80);
var beams = require('beams');
beams.setServer(server);
var messages = [];
beams
  .connect(function (beam) {
    beam.emit('messages', messages);
  })
  .on('message', function (text) {
    var message = {from: this.id, text: data};
    messages.push(message);
    beams.emit('messages', [message]);
  });
```

```html
<script src="http://localhost/beams-client.min.js"></script>
<script>
Beams()
  .on('messages', function (data) {
    console.log(data);
    beam.emit('my other event', { my: 'data' });
  });
</script>
```


## API

#### beams.setServer(Server server)
Pass an Express-like server to `setServer`, and it will create a Beams server on
top of the server.
`route` on any assets that you'd like to route via `server.get`

#### beams.connect(function callback)
Run a callback when a client connects.

#### beams.on(string name, function callback)
When a message with a given name is received, run a callback on each client.
The `callback` takes a `data` argument, and its `this` context is the client
on which it is being run.

#### beams.handle(string name, function callback)
Remove any existing handlers for the specified message name, and replace
with a single `callback`, like calling `beams.on` only once.  This is useful
for frameworks that reload modules in dev mode rather than restarting the
server.

#### beams.emit(string name, object data)
Send a named message with some data to every client.

#### beams.each(callback)
Run a callback on each client. The `callback` takes a `client` argument.

#### Array beams.clients
A list of the clients that are connected.

#### Object beams.handlers
Arrays of message handlers keyed by message name.

#### number beams.pollTimeout
How long (in milliseconds) to wait before forcing clients to reconnect.
