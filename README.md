# Beams

[![NPM Version](https://badge.fury.io/js/beams.png)](http://badge.fury.io/js/beams)
[![Build Status](https://travis-ci.org/zerious/beams.png?branch=master)](https://travis-ci.org/zerious/beams)
[![Code Coverage](https://coveralls.io/repos/zerious/beams/badge.png?branch=master)](https://coveralls.io/r/zerious/beams)
[![Dependencies](https://david-dm.org/zerious/beams.png?theme=shields.io)](https://david-dm.org/zerious/beams)
[![Support](http://img.shields.io/gittip/zerious.png)](https://www.gittip.com/zerious/)

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
getBeams()
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

#### beams.emit(string name, object data)
Send a named message with some data to every client.

#### beams.each(callback)
Run a callback on each client. The `callback` takes a `client` argument.