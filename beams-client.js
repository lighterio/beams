/**
 *  ____                              ____ _ _            _            ___   ___   _ 
 * | __ )  ___  __ _ _ __ ___  ___   / ___| (_) ___ _ __ | |_  __   __/ _ \ / _ \ / |
 * |  _ \ / _ \/ _` | '_ ` _ \/ __| | |   | | |/ _ \ '_ \| __| \ \ / / | | | | | || |
 * | |_) |  __/ (_| | | | | | \__ \ | |___| | |  __/ | | | |_   \ V /| |_| | |_| || |
 * |____/ \___|\__,_|_| |_| |_|___/  \____|_|_|\___|_| |_|\__|   \_/  \___(_)___(_)_|
 *                                                                                   
 *
 * http://lighter.io/beams
 * MIT License
 *
 * Source files:
 *   https://github.com/zerious/jymin/blob/master/core/ajax.js
 *   https://github.com/zerious/jymin/blob/master/core/collections.js
 *   https://github.com/zerious/jymin/blob/master/core/logging.js
 *   https://github.com/zerious/beams/blob/master/scripts/beams-jymin.js
 */


/**
 * Empty handler.
 */
var doNothing = function () {};
var globalResponseSuccessHandler = doNothing;
var globalResponseFailureHandler = doNothing;

/**
 * Make an AJAX request, and handle it with success or failure.
 * @return boolean: True if AJAX is supported.
 */
var getResponse = function (
	url,       // string*:  The URL to request data from.
	data,      // object:   Data to post. The method is automagically "POST" if data is truey, otherwise "GET".
	onSuccess, // function: Callback to run on success. `onSuccess(response, request)`.
	onFailure, // function: Callback to run on failure. `onFailure(response, request)`.
	evalJson   // boolean:  Whether to evaluate the response as JSON.
) {
	// If the optional data argument is omitted, shuffle it out.
	if (typeof data == 'function') {
		evalJson = onFailure;
		onFailure = onSuccess;
		onSuccess = data;
		data = 0;
	}
	var request;
	if (window.XMLHttpRequest) {
		request = new XMLHttpRequest();
	} else if (window.ActiveXObject) {
		request = new ActiveXObject('Microsoft.XMLHTTP');
	} else {
		return false;
	}
	if (request) {
		request.onreadystatechange = function() {
			if (request.readyState == 4) {
				var callback = request.status == 200 ?
					onSuccess || globalResponseSuccessHandler :
					onFailure || globalResponseFailureHandler;
				var response = request.responseText;
				if (evalJson) {
					try {
						// Trick Uglify into thinking there's no eval.
						var e = window.eval;
						e('eval.J=' + response);
						response = e.J;
					}
					catch (e) {
						log('ERROR: Could not parse JSON', response);
					}
				}
				callback(response, request);
			}
		};
		request.open(data ? 'POST' : 'GET', url, true);
		if (data) {
			request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		}
		request.send(data || null);
	}
	return true;
};

/**
 * Request a JSON resource with a given URL.
 * @return boolean: True if AJAX is supported.
 */
var getJson = function (
	url,       // string*:  The URL to request data from.
	onSuccess, // function: Callback to run on success. `onSuccess(response, request)`.
	onFailure  // function: Callback to run on failure. `onFailure(response, request)`.
) {
	return getResponse(url, onSuccess, onFailure, true);
};

/**
 * Iterate over an array, and call a function on each item.
 */
var forEach = function (
	array,   // Array*:    The array to iterate over.
	callback // function*: The function to call on each item. `callback(item, index, array)`
) {
    if (array) {
        for (var index = 0, length = array.length; index < length; index++) {
            var result = callback(array[index], index, array);
            if (result === false) {
                break;
            }
        }
    }
};

/**
 * Iterate over an object's keys, and call a function on each key value pair.
 */
var forIn = function (
	object,  // object*:   The object to iterate over.
	callback // function*: The function to call on each pair. `callback(value, key, object)`
) {
    if (object) {
        for (var key in object) {
            var result = callback(object[key], key, object);
            if (result === false) {
                break;
            }
        }
    }
};

/**
 * Decorate an object with properties from another object. If the properties
 */
var decorateObject = function (
	object,      // object*: The object to decorate.
	decorations  // object*: The object to iterate over.
) {
    if (object && decorations) {
		forIn(decorations, function (value, key) {
			object[key] = value;
		});
    }
    return object;
};

/**
 * Log values to the console, if it's available.
 */
var log = function (
	message,
	object
) {
    if (window.console && console.log) {
        // Prefix the first argument (hopefully a string) with the marker.
        if (typeof object == 'undefined') {
            console.log(message);
        }
        else {
            console.log(message, object);
        }
    }
};

var BEAMS_RETRY_TIMEOUT = 1e3;

var getBeams = function () {

	// The beams server listens for GET and POST requests at /BEAM.
	var serverUrl = '/BEAM';
	var endpoint = serverUrl;

	// When a message is received, its list of callbacks can be looked up by message name.
	var callbacks = {};

	// Keep a count of emissions so the server can de-duplicate.
	var count = 0;

	// Create a client.
	var client = {

		connect: function (callback) {
			this.on('connect', callback);
			return client;
		},

		on: function (name, callback) {
			var list = callbacks[name]
			if (!list) {
				list = callbacks[name] = [];
			}
			list.push(callback);
			return client;
		},

		emit: function (name, data) {
			// The server can use the count to ignore duplicates.
			count++;
			// Try to emit data to the server.
			function send() {
				getResponse(
					// Send the event name and emission count as URL params.
					endpoint + '&name=' + escape(name) + '&count=' + count,
					// Send the message data as POST body so we're not size-limited.
					data,
					// On success, there's nothing we need to do.
					doNothing,
					// On failure, retry.
					function () {
						setTimeout(send, BEAMS_RETRY_TIMEOUT);
					}
				);
			}
			return client;
		}

	};

	// Poll for a new list of messages.
	function poll() {
		getJson(endpoint, function (messages) {
			// Iterate through the messages, triggering events.
			forEach(messages, function (message) {
				var name = message[0];
				var data = message[1];
				trigger(name, data);
			});
			// Poll again.
			poll();
		},
		function () {
			log('ERROR: Failed to connect (' + endpoint + ').');
			// Try again later.
			setTimeout(poll, BEAMS_RETRY_TIMEOUT);
		});
	};

	// Trigger any related callbacks with received data.
	function trigger(name, data) {
		forEach(callbacks[name], function (callback) {
			callback.call(client, data);
		});
	};

	// When a client connects, set the client id.
	client.connect(function (data) {
		decorateObject(client, data);
		endpoint = serverUrl + '?id=' + client.id;
	});

	poll();

	return client;
};

window.getBeams = getBeams;