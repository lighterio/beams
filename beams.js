var Client = require('./lib/Client');

// TODO: Scale Beams servers with a hash ring module.

var api = module.exports = {};

/**
 * Expose the Beams version to module users.
 */
api.version = require('./package.json').version;

api._clients = {};

api._callbacks = {};

api._pollDuration = 3e4; // 30 seconds.

/**
 * Accept an Express-like server and make it a Beams server as well.
 */
api.setServer = function setServer(server) {

	/**
	 * Accept a client's long polling request.
	 */
	server.get('/BEAM', function (request, response) {
		getClient(request, response);
	});

	/**
	 * Receive data from a client, and trigger actions.
	 */
	server.post('/BEAM', function (request, response) {
		var query = request.query;
		var name = query.name;
		var callbacks = api._callbacks[name];
		if (callbacks) {
			api.each(function (client) {
				callbacks.forEach(function (callback) {
					callback.call(client, request.body);
				});
			});
		}
		// So long, and thanks for all the data.
		response.statusCode = 200;
		response.setHeader('content-type', 'text/json');
		response.end('{received: true}');
	});

};

/**
 * Get the client based on the request.
 * If it must be created, set the client ID in the response.
 */
function getClient(request, response) {
	var id = request.query.id;
	var client = api._clients[id];

	// If the client already exists, wait for data to send to it.
	if (client) {
		client.wait(request, response);
	}

	// If the client doesn't exist, create it.
	else {
		do {
			client = new Client(request, response, api);
			id = client.id;
			// Ensure that its ID is unique.
		} while (api._clients[id]);

		// Add the client to our collection.
		api._clients[id] = client;

		// If there's something to run on connect, run it.
		if (api._callbacks.connect) {
			api._callbacks.connect.forEach(function (callback) {
				callback.call(client, client);
			});
		}
	}
	return client;
}

/**
 * Run a callback when a client connects.
 */
api.connect = function (callback) {
	api.on('connect', callback);
};

/**
 * Listen for a message by name.
 */
api.on = function (name, callback) {
	var callbacks = api._callbacks[name]
	if (!callbacks) {
		callbacks = api._callbacks[name] = [];
	}
	callbacks.push(callback);
};

/**
 * Emit data to each client.
 */
api.emit = function (name, data) {
	api.each(function (client) {
		client.emit(name, data);
	});
};

/**
 * Run a callback on each client.
 */
api.each = function (callback) {
	var clients = api._clients;
	for (var id in clients) {
		callback(clients[id]);
	}
};
