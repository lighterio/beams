/**
 *  ____                              ____ _ _            _            ___   ___   _  ___
 * | __ )  ___  __ _ _ __ ___  ___   / ___| (_) ___ _ __ | |_  __   __/ _ \ / _ \ / |/ _ \
 * |  _ \ / _ \/ _` | '_ ` _ \/ __| | |   | | |/ _ \ '_ \| __| \ \ / / | | | | | || | | | |
 * | |_) |  __/ (_| | | | | | \__ \ | |___| | |  __/ | | | |_   \ V /| |_| | |_| || | |_| |
 * |____/ \___|\__,_|_| |_| |_|___/  \____|_|_|\___|_| |_|\__|   \_/  \___(_)___(_)_|\___/
 *
 *
 * http://lighter.io/beams
 * MIT License
 *
 * Source files:
 *   https://github.com/zerious/jymin/blob/master/scripts/ajax.js
 *   https://github.com/zerious/jymin/blob/master/scripts/collections.js
 *   https://github.com/zerious/jymin/blob/master/scripts/logging.js
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
  url,       // string:    The URL to request a response from.
  body,      // object|:   Data to post. The method is automagically "POST" if body is truey, otherwise "GET".
  onSuccess, // function|: Callback to run on success. `onSuccess(response, request)`.
  onFailure, // function|: Callback to run on failure. `onFailure(response, request)`.
  evalJson   // boolean|:  Whether to evaluate the response as JSON.
) {
  // If the optional body argument is omitted, shuffle it out.
  if (isFunction(body)) {
    evalJson = onFailure;
    onFailure = onSuccess;
    onSuccess = body;
    body = 0;
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
        --getResponse._WAITING;
        var status = request.status;
        var isSuccess = (status == 200);
        var callback = isSuccess ?
          onSuccess || globalResponseSuccessHandler :
          onFailure || globalResponseFailureHandler;
        var response = request.responseText;
        if (evalJson) {
          var object;
          if (status) {
            try {
              // Trick Uglify into thinking there's no eval.
              var e = window.eval;
              e('eval.J=' + response);
              object = e.J;
            }
            catch (e) {
              //+env:dev
              error('Could not parse JSON: "' + response + '"');
              //-env:dev
              object = {_ERROR: '_BAD_JSON', _TEXT: response};
            }
          }
          else {
            object = {_ERROR: '_OFFLINE'};
          }
          object._STATUS = status;
          object.request = request;
          response = object;
        }
        callback(response, request);
      }
    };
    request.open(body ? 'POST' : 'GET', url, true);
    request.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    if (body) {
      request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    }
    getResponse._WAITING = (getResponse._WAITING || 0) + 1;

    // Record the original request URL.
    request.url = url;

    // TODO: Populate request.query with URL query params.

    // If it's a post, record the post body.
    if (body) {
      request.body = body;
    }

    //
    request._TIME = new Date();
    request.send(body || null);
  }
  return true;
};

/**
 * Request a JSON resource with a given URL.
 * @return boolean: True if AJAX is supported.
 */
var getJson = function (
  url,       // string:    The URL to request a response from.
  body,      // object|:   Data to post. The method is automagically "POST" if body is truey, otherwise "GET".
  onSuccess, // function|: Callback to run on success. `onSuccess(response, request)`.
  onFailure  // function|: Callback to run on failure. `onFailure(response, request)`.
) {
  return getResponse(url, body, onSuccess, onFailure, true);
};
/**
 * Iterate over an array, and call a function on each item.
 */
var forEach = function (
  array,   // Array*:    The array to iterate over.
  callback // Function*: The function to call on each item. `callback(item, index, array)`
) {
    if (array) {
        for (var index = 0, length = getLength(array); index < length; index++) {
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
  object,  // Object*:   The object to iterate over.
  callback // Function*: The function to call on each pair. `callback(value, key, object)`
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
  object,     // Object: The object to decorate.
  decorations // Object: The object to iterate over.
) {
    if (object && decorations) {
    forIn(decorations, function (value, key) {
      object[key] = value;
    });
    }
    return object;
};

/**
 * Ensure that a property exists by creating it if it doesn't.
 */
var ensureProperty = function (
  object,
  property,
  defaultValue
) {
  var value = object[property];
  if (!value) {
    value = object[property] = defaultValue;
  }
  return value;
};

/**
 * Get the length of an array.
 * @return number: Array length.
 */
var getLength = function (
  array // Array|DomNodeCollection|String: The object to check for length.
) {
  return isInstance(array) || isString(array) ? array.length : 0;
};

/**
 * Get the first item in an array.
 * @return mixed: First item.
 */
var getFirst = function (
  array // Array: The array to get the
) {
  return isInstance(array) ? array[0] : undefined;
};

/**
 * Get the first item in an array.
 * @return mixed: First item.
 */
var getLast = function (
  array // Array: The array to get the
) {
  return isInstance(array) ? array[getLength(array) - 1] : undefined;
};

/**
 * Check for multiple array items.
 * @return boolean: true if the array has more than one item.
 */
var hasMany = function (
  array // Array: The array to check for item.
) {
  return getLength(array) > 1;
};

/**
 * Push an item into an array.
 * @return mixed: Pushed item.
 */
var push = function (
  array, // Array: The array to push the item into.
  item   // mixed: The item to push.
) {
  if (isArray(array)) {
    array.push(item);
  }
  return item;
};

var merge = function (
  array, // Array:  The array to merge into.
  items  // mixed+: The items to merge into the array.
) {
  for (var i = 1, l = arguments.length; i < l; i++) {
    items = arguments[i];
    // TODO: Use splice instead of push to get better performance?
    forEach(items, function (item) {
      array.push(item);
    });
  }
};

/**
 * Push padding values onto an array up to a specified length.
 * @return number: The number of padding values that were added.
 */
var pad = function (
  array,       // Array:  The array to check for items.
  padToLength, // number: The minimum number of items in the array.
  paddingValue // mixed|: The value to use as padding.
) {
  var countAdded = 0;
  if (isArray(array)) {
    var startingLength = getLength(array);
    if (startingLength < length) {
      paddingValue = isDefined(paddingValue) ? paddingValue : '';
      for (var index = startingLength; index < length; index++) {
        array.push(paddingValue);
        countAdded++;
      }
    }
  }
  return countAdded;
};
/**
 * Log values to the console, if it's available.
 */
var error = function () {
  ifConsole('error', arguments);
};

/**
 * Log values to the console, if it's available.
 */
var warn = function () {
  ifConsole('warn', arguments);
};

/**
 * Log values to the console, if it's available.
 */
var info = function () {
  ifConsole('info', arguments);
};

/**
 * Log values to the console, if it's available.
 */
var log = function () {
  ifConsole('log', arguments);
};

/**
 * Log values to the console, if it's available.
 */
var trace = function () {
  ifConsole('trace', arguments);
};

/**
 * Log values to the console, if it's available.
 */
var ifConsole = function (method, args) {
  var console = window.console;
  if (console && console[method]) {
    console[method].apply(console, args);
  }
};
/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 */

var BEAMS_RETRY_TIMEOUT = 1e3;

var Beams = function () {

  // If we've already created a client, use it.
  var client = Beams._CLIENT;
  if (client) {
    return client;
  }

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpointUrl = serverUrl;

  // Until we connect, queue emissions.
  var emissions = [];

  // When a message is received, its list of callbacks can be looked up by message name.
  var callbacks = {};

  // If onReady gets called more than once, reset callbacks.
  // When used with D6, calls to "client.on" should be inside onReady callbacks.
  var hasRendered = false;
  onReady(function () {
    if (hasRendered) {
      callbacks = {};
    }
    hasRendered = true;
  });

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  // Create a client.
  client = Beams._CLIENT = {};

  client._CONNECT = client.connect = function (callback) {
    this._ON('connect', callback);
    return client;
  };

  client._ON = client.on = function (name, callback) {
    var list = callbacks[name]
    if (!list) {
      list = callbacks[name] = [];
    }
    push(list, callback);
    return client;
  };

  client._EMIT = client.emit = function (name, data) {
    // The server can use the count to ignore duplicates.
    n++;
    // Try to emit data to the server.
    function send() {
      getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        data || {},
        // On success, there's nothing we need to do.
        doNothing,
        // On failure, retry.
        function () {
          setTimeout(send, BEAMS_RETRY_TIMEOUT);
        }
      );
    }
    if (client.id) {
      send();
    }
    else {
      emissions.push(send);
    }
    return client;
  };

  // Poll for a new list of messages.
  function poll() {
    getResponse(endpointUrl, 0, function (messages) {
      // Iterate through the messages, triggering events.
      forEach(messages, function (message) {
        var name = message[0];
        var data = message[1];
        trigger(name, data);
      });
      // Poll again.
      poll();
    },
    function (response) {
      log('ERROR: Failed to connect (' + endpointUrl + ').');
      // Try again later.
      setTimeout(poll, BEAMS_RETRY_TIMEOUT);
    }, 1);
  };

  // Trigger any related callbacks with received data.
  function trigger(name, data) {
    forEach(callbacks[name], function (callback) {
      callback.call(client, data);
    });
  };

  // When a client connects, set the client id.
  client._CONNECT(function (data) {
    decorateObject(client, data);
    endpointUrl = serverUrl + '?id=' + client.id;

    // Now that we have the client ID, we can emit anything we queued.
    emissions.forEach(function (send) {
      send();
    });
    emissions = [];
  });

  poll();

  return client;
};

window.Beams = Beams;
