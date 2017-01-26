# <a href="http://lighter.io/beams" style="font-size:40px;text-decoration:none"><img src="https://cdn.rawgit.com/lighterio/lighter.io/master/public/beams.svg" style="width:90px;height:90px"> Beams</a>
[![Chat](https://badges.gitter.im/chat.svg)](//gitter.im/lighterio/public)
[![Version](https://img.shields.io/npm/v/beams.svg)](//www.npmjs.com/package/beams)
[![Downloads](https://img.shields.io/npm/dm/beams.svg)](//www.npmjs.com/package/beams)
[![Build](https://img.shields.io/travis/lighterio/beams.svg)](//travis-ci.org/lighterio/beams)
[![Coverage](https://img.shields.io/codecov/c/github/lighterio/beams/master.svg)](//codecov.io/gh/lighterio/beams)
[![Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](//www.npmjs.com/package/standard)


Beams is a long-polling Node.js server extension and client library.

### Quick Start

Install `beams` in your project:
```bash
npm install --save beams
```

Then here's a simple chat server and client:
```js
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


## More on Beams...
* [Contributing](//github.com/lighterio/beams/blob/master/CONTRIBUTING.md)
* [License (ISC)](//github.com/lighterio/beams/blob/master/LICENSE.md)
* [Change Log](//github.com/lighterio/beams/blob/master/CHANGELOG.md)
* [Roadmap](//github.com/lighterio/beams/blob/master/ROADMAP.md)
