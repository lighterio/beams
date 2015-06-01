# <a href="http://lighter.io/beams" style="font-size:40px;text-decoration:none;color:#000"><img src="https://cdn.rawgit.com/lighterio/lighter.io/master/public/beams.svg" style="width:90px;height:90px"> Beams</a>
[![NPM Version](https://img.shields.io/npm/v/beams.svg)](https://npmjs.org/package/beams)
[![Downloads](https://img.shields.io/npm/dm/beams.svg)](https://npmjs.org/package/beams)
[![Build Status](https://img.shields.io/travis/lighterio/beams.svg)](https://travis-ci.org/lighterio/beams)
[![Code Coverage](https://img.shields.io/coveralls/lighterio/beams/master.svg)](https://coveralls.io/r/lighterio/beams)
[![Dependencies](https://img.shields.io/david/lighterio/beams.svg)](https://david-dm.org/lighterio/beams)
[![Support](https://img.shields.io/gratipay/Lighter.io.svg)](https://gratipay.com/Lighter.io/)


Beams is a long-polling Node.js server extension and client library.

### Quick Start

Install `beams` in your project:
```bash
npm install --save beams
```

Then here's a simple chat server and client:
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


## Acknowledgements

We would like to thank all of the amazing people who use, support,
promote, enhance, document, patch, and submit comments & issues.
Beams couldn't exist without you.

Additionally, huge thanks go to [Goin’](https://goin.io) for employing
and supporting [Beams](http://lighter.io/beams) project maintainers,
and for being an epically awesome place to work (and play).


## MIT License

Copyright (c) 2014 Sam Eubank

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## How to Contribute

We welcome contributions from the community and are happy to have them.
Please follow this guide when logging issues or making code changes.

### Logging Issues

All issues should be created using the
[new issue form](https://github.com/lighterio/beams/issues/new).
Please describe the issue including steps to reproduce. Also, make sure
to indicate the version that has the issue.

### Changing Code

Code changes are welcome and encouraged! Please follow our process:

1. Fork the repository on GitHub.
2. Fix the issue ensuring that your code follows the
   [style guide](http://lighter.io/style-guide).
3. Add tests for your new code, ensuring that you have 100% code coverage.
   (If necessary, we can help you reach 100% prior to merging.)
   * Run `npm test` to run tests quickly, without testing coverage.
   * Run `npm run cover` to test coverage and generate a report.
   * Run `npm run report` to open the coverage report you generated.
4. [Pull requests](http://help.github.com/send-pull-requests/) should be made
   to the [master branch](https://github.com/lighterio/beams/tree/master).

### Contributor Code of Conduct

As contributors and maintainers of Beams, we pledge to respect all
people who contribute through reporting issues, posting feature requests,
updating documentation, submitting pull requests or patches, and other
activities.

If any participant in this project has issues or takes exception with a
contribution, they are obligated to provide constructive feedback and never
resort to personal attacks, trolling, public or private harassment, insults, or
other unprofessional conduct.

Project maintainers have the right and responsibility to remove, edit, or
reject comments, commits, code, edits, issues, and other contributions
that are not aligned with this Code of Conduct. Project maintainers who do
not follow the Code of Conduct may be removed from the project team.

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported by opening an issue or contacting one or more of the project
maintainers.

We promise to extend courtesy and respect to everyone involved in this project
regardless of gender, gender identity, sexual orientation, ability or
disability, ethnicity, religion, age, location, native language, or level of
experience.
