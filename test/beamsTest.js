var beams = require('../beams');

require('zeriousify').test();

var server, request, response;

describe('Beams', function () {

  beforeEach(function () {
    server = {
      get: function (path, callback) {
        this._get = callback;
      },
      post: function (path, callback) {
        this._post = callback;
      }
    };
    request = {
      url: '/beam',
      query: {}
    };
    response = {
      headers: {},
      setHeader: function(name, value) {
        this.headers[name] = value;
      },
      query: {},
      output: '',
      end: function (data) {
        this.output = data;
      }
    };
    beams.clients = {};
    beams.setServer(server);
  });

  it('.setServer', function () {
      beams.setServer(server);
  });

  it('.on', function () {
    var out = '';
    beams.on('snap', function (data) {
      out += data;
    });
    request.query = {
      id: 1,
      m: 'snap'
    };
    server._get(request, response);
    request.body = {d: 'crackle!'};
    server._post(request, response);
    is(out, 'crackle!');

    beams.on('snap', function (data) {
      out += data;
    });
    request.body = {d: 'pop!'};
    server._post(request, response);
    is(out, 'crackle!pop!pop!');
  });

  it('.handle', function () {
    var out = '';
    request.query = {
      id: 1,
      m: 'snap'
    };
    request.body = {d: '!'};
    function append(data) {
      out += data;
    }
    beams.on('snap', append).on('snap', append);
    server._post(request, response);
    is(out, '!!');

    beams.handle('snap', append).handle('snap', append);
    server._post(request, response);
    is(out, '!!!');
  });

  it('.connect', function () {
    var connected = false;
    beams.connect(function() {
      connected = true;
    });
    server._get(request, response);
  });

  it('.emit', function () {
    beams.emit('ping', 'pong');
  });

  it('get', function () {
    server._get(request, response);
    var count, id, key;
    count = 0;
    for (key in beams.clients) {
      count++;
      id = key;
    }
    is(count, 1);
    request.query.id = id;
    server._get(request, response);
    count = 0;
    for (key in beams.clients) {
      count++;
    }
    is(count, 1);
  });

  it('post', function () {
    server._post(request, response);
  });

  it('client', function () {
    server._get(request, response);
    var client;
    var clients = beams.clients;
    for (var key in clients) {
      client = clients[key];
    }
    client.wait(request, response);

    // Create an existing buffer so it will be added to.
    client.buffer = '["ping","pong"]';
    beams.emit('bing', 'bong');
    is(response.output, '[["ping","pong"],["bing","bong"]]');

    // Wait for data when there's already data, triggering an immediate emit.
    request.output = '';
    client.buffer = '["ping","pong"]';
    client.wait(request, response);
    is(response.output, '[["ping","pong"]]');

    // Verify that headers aren't rewritten.
    client.buffer = '["no","set"]';
    response._header = 'sent';
    response.headers = {};
    client.wait(request, response);
    is(response.output, '[["no","set"]]');
    is(JSON.stringify(response.headers), '{}');
  });

  it('timeout', function (done) {
    beams.pollTimeout = 1;
    server._get(request, response);
    setTimeout(done, 10);
  });

});
