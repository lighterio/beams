require('zeriousify').test();
var assert = require('assert-plus');
var api = require('../beams');


var app, request, response;

describe('Beams', function () {

	beforeEach(function () {
		app = {
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
		api.setApp(app);
	});

	it('.setApp', function () {
		api.setApp(app);
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
		app._get(request, response);
		app._post(request, response);
		assert.equal(out, 'crackle!');

		api.on('snap', function (data) {
			out += data;
		});
		request.body = 'pop!';
		app._post(request, response);
		assert.equal(out, 'crackle!pop!pop!');
	});

	it('.connect', function () {
		var connected = false;
		api.connect(function() {
			connected = true;
		});
		app._get(request, response);
	});

	it('.emit', function () {
		api.emit('ping', 'pong');
	});

	it('get', function () {
		app._get(request, response);
		var count, id, key;
		count = 0;
		for (key in api._clients) {
			count++;
			id = key;
		}
		assert.equal(count, 1);
		request.query.id = id;
		app._get(request, response);
		count = 0;
		for (key in api._clients) {
			count++;
		}
		assert.equal(count, 1);
	});

	it('post', function () {
		app._post(request, response);
	});

	it('client', function () {
		app._get(request, response);
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
	});

	it('timeout', function (done) {
		api._pollDuration = 1;
		app._get(request, response);
		setTimeout(done, 10);
	});

});