var assert = require('assert-plus');
var api = require('../beams');

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
      url: '/BEAM',
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
    api._clients = {};
    api.setServer(server);
  });

  it('.setServer', function () {
    api.setServer(server);
  });

  it('.on', function () {
    var out = '';
    api.on('snap', function (data) {
      out += data;
    });
    request.query = {
      id: 1,
      name: 'snap'
    };
    request.body = 'crackle!';
    server._get(request, response);
    server._post(request, response);
    assert.equal(out, 'crackle!');

    api.on('snap', function (data) {
      out += data;
    });
    request.body = 'pop!';
    server._post(request, response);
    assert.equal(out, 'crackle!pop!pop!');
  });

  it('.connect', function () {
    var connected = false;
    api.connect(function() {
      connected = true;
    });
    server._get(request, response);
  });

  it('.emit', function () {
    api.emit('ping', 'pong');
  });

  it('get', function () {
    server._get(request, response);
    var count, id, key;
    count = 0;
    for (key in api._clients) {
      count++;
      id = key;
    }
    assert.equal(count, 1);
    request.query.id = id;
    server._get(request, response);
    count = 0;
    for (key in api._clients) {
      count++;
    }
    assert.equal(count, 1);
  });

  it('post', function () {
    server._post(request, response);
  });

  it('client', function () {
    server._get(request, response);
    var client;
    var clients = api._clients;
    for (var key in clients) {
      client = clients[key];
    }
    client.wait(request, response);

    // Create an existing buffer so it will be added to.
    client.buffer = '["ping","pong"]';
    api.emit('bing', 'bong');
    assert.equal(response.output, '[["ping","pong"],["bing","bong""]]');

    // Wait for data when there's already data, triggering an immediate emit.
    request.output = '';
    client.buffer = '["ping","pong"]';
    client.wait(request, response);
    assert.equal(response.output, '[["ping","pong"]]');

    // Verify that headers aren't rewritten.
    client.buffer = '["no","set"]';
    response._header = 'sent';
    response.headers = {};
    client.wait(request, response);
    assert.equal(response.output, '[["no","set"]]');
    assert.equal(JSON.stringify(response.headers), '{}');
  });

  it('timeout', function (done) {
    api._pollDuration = 1;
    server._get(request, response);
    setTimeout(done, 10);
  });

});
