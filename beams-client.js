/**
 *  ____                              ____ _ _            _            ___   ___   _  __
 * | __ )  ___  __ _ _ __ ___  ___   / ___| (_) ___ _ __ | |_  __   __/ _ \ / _ \ / |/ /_
 * |  _ \ / _ \/ _` | '_ ` _ \/ __| | |   | | |/ _ \ '_ \| __| \ \ / / | | | | | || | '_ \
 * | |_) |  __/ (_| | | | | | \__ \ | |___| | |  __/ | | | |_   \ V /| |_| | |_| || | (_) |
 * |____/ \___|\__,_|_| |_| |_|___/  \____|_|_|\___|_| |_|\__|   \_/  \___(_)___(_)_|\___/
 *
 *
 * http://lighter.io/beams
 * MIT License
 *
 * Source files:
 *   https://github.com/zerious/jymin/blob/master/scripts/ajax.js
 *   https://github.com/zerious/jymin/blob/master/scripts/collections.js
 *   https://github.com/zerious/jymin/blob/master/scripts/dates.js
 *   https://github.com/zerious/jymin/blob/master/scripts/logging.js
 *   https://github.com/zerious/jymin/blob/master/scripts/strings.js
 *   https://github.com/zerious/jymin/blob/master/scripts/types.js
 *   https://github.com/zerious/beams/blob/master/scripts/beams-jymin.js
 */


/**
 * Empty handler.
 */
var doNothing = function () {};

// TODO: Enable multiple handlers using "bind" or perhaps middlewares.
var responseSuccessHandler = doNothing;
var responseFailureHandler = doNothing;

/**
 * Get an XMLHttpRequest object.
 */
var getXhr = function () {
  var Xhr = window.XMLHttpRequest;
  var ActiveX = window.ActiveXObject;
  return Xhr ? new Xhr() : (ActiveX ? new ActiveX('Microsoft.XMLHTTP') : false);
};

/**
 * Make an AJAX request, and handle it with success or failure.
 * @return boolean: True if AJAX is supported.
 */
var getResponse = function (
  url,       // string:    The URL to request a response from.
  body,      // object|:   Data to post. The method is automagically "POST" if body is truey, otherwise "GET".
  onSuccess, // function|: Callback to run on success. `onSuccess(response, request)`.
  onFailure  // function|: Callback to run on failure. `onFailure(response, request)`.
) {
  // If the optional body argument is omitted, shuffle it out.
  if (isFunction(body)) {
    onFailure = onSuccess;
    onSuccess = body;
    body = 0;
  }
  var request = getXhr();
  if (request) {
    onFailure = onFailure || responseFailureHandler;
    onSuccess = onSuccess || responseSuccessHandler;
    request.onreadystatechange = function() {
      if (request.readyState == 4) {
        //+env:debug
        log('[Jymin] Received response from "' + url + '". (' + getResponse._WAITING + ' in progress).');
        //-env:debug
        --getResponse._WAITING;
        var status = request.status;
        var isSuccess = (status == 200);
        var callback = isSuccess ?
          onSuccess || responseSuccessHandler :
          onFailure || responseFailureHandler;
        var data = parse(request.responseText);
        data._STATUS = status;
        data._REQUEST = request;
        callback(data);
      }
    };
    request.open(body ? 'POST' : 'GET', url, true);
    request.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    if (body) {
      request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    }

    // Record the original request URL.
    request._URL = url;

    // If it's a post, record the post body.
    if (body) {
      request._BODY = body;
    }

    // Record the time the request was made.
    request._TIME = getTime();

    // Allow applications to back off when too many requests are in progress.
    getResponse._WAITING = (getResponse._WAITING || 0) + 1;

    //+env:debug
    log('[Jymin] Sending request to "' + url + '". (' + getResponse._WAITING + ' in progress).');
    //-env:debug
    request.send(body || null);

  }
  return true;
};
/**
 * Iterate over an array, and call a function on each item.
 */
var forEach = function (
  array,   // Array:    The array to iterate over.
  callback // Function: The function to call on each item. `callback(item, index, array)`
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
 * Iterate over an array, and call a callback with (index, value), as in jQuery.each
 */
var each = function (
  array,   // Array:    The array to iterate over.
  callback // Function: The function to call on each item. `callback(item, index, array)`
) {
  if (array) {
    for (var index = 0, length = getLength(array); index < length; index++) {
      var result = callback(index, array[index], array);
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
      var result = callback(key, object[key], object);
      if (result === false) {
        break;
      }
    }
  }
};

/**
 * Iterate over an object's keys, and call a function on each (value, key) pair.
 */
var forOf = function (
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
    forIn(decorations, function (key, value) {
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

/**
 * Pop an item off an array.
 * @return mixed: Popped item.
 */
var pop = function (
  array // Array: The array to push the item into.
) {
  if (isArray(array)) {
    return array.pop();
  }
};

var merge = function (
  array, // Array:  The array to merge into.
  items  // mixed+: The items to merge into the array.
) {
  // TODO: Use splice instead of pushes to get better performance?
  var addToFirstArray = function (item) {
    array.push(item);
  };
  for (var i = 1, l = arguments.length; i < l; i++) {
    forEach(arguments[i], addToFirstArray);
  }
};

/**
 * Push padding values onto an array up to a specified length.
 * @return number: The number of padding values that were added.
 */
var padArray = function (
  array,       // Array:  The array to check for items.
  padToLength, // number: The minimum number of items in the array.
  paddingValue // mixed|: The value to use as padding.
) {
  var countAdded = 0;
  if (isArray(array)) {
    var startingLength = getLength(array);
    if (startingLength < length) {
      paddingValue = isUndefined(paddingValue) ? '' : paddingValue;
      for (var index = startingLength; index < length; index++) {
        array.push(paddingValue);
        countAdded++;
      }
    }
  }
  return countAdded;
};
/**
 * Get Unix epoch milliseconds from a date.
 * @return integer: Epoch milliseconds.
 */
var getTime = function (
  date // Date: Date object. (Default: now)
) {
  date = date || new Date();
  return date.getTime();
};

/**
 * Get Unix epoch milliseconds from a date.
 * @return integer: Epoch milliseconds.
 */
var getIsoDate = function (
  date // Date: Date object. (Default: now)
) {
  if (!date) {
    date = new Date();
  }
  if (date.toISOString) {
    date = date.toISOString();
  }
  else {
    // Build an ISO date string manually in really old browsers.
    var utcPattern = /^.*?(\d+) (\w+) (\d+) ([\d:]+).*?$/;
    date = date.toUTCString().replace(utcPattern, function (a, d, m, y, t) {
      m = zeroFill(date.getMonth(), 2);
      t += '.' + zeroFill(date.getMilliseconds(), 3);
      return y + '-' + m + '-' + d + 'T' + t + 'Z';
    });
  }
  return date;
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
 * Ensure a value is a string.
 */
var ensureString = function (
  value
) {
  return isString(value) ? value : '' + value;
};

/**
 * Return true if the string contains the given substring.
 */
var contains = function (
  string,
  substring
) {
  return ensureString(string).indexOf(substring) > -1;
};

/**
 * Return true if the string starts with the given substring.
 */
var startsWith = function (
  string,
  substring
) {
  return ensureString(string).indexOf(substring) == 0; // jshint ignore:line
};

/**
 * Trim the whitespace from a string.
 */
var trim = function (
  string
) {
  return ensureString(string).replace(/^\s+|\s+$/g, '');
};

/**
 * Split a string by commas.
 */
var splitByCommas = function (
  string
) {
  return ensureString(string).split(',');
};

/**
 * Split a string by spaces.
 */
var splitBySpaces = function (
  string
) {
  return ensureString(string).split(' ');
};

/**
 * Return a string, with asterisks replaced by values from a replacements array.
 */
var decorateString = function (
  string,
  replacements
) {
  string = ensureString(string);
  forEach(replacements, function(replacement) {
    string = string.replace('*', replacement);
  });
  return string;
};

/**
 * Perform a RegExp match, and call a callback on the result;
  */
var match = function (
  string,
  pattern,
  callback
) {
  var result = string.match(pattern);
  if (result) {
    callback.apply(string, result);
  }
};

/**
 * Reduce a string to its alphabetic characters.
 */
var extractLetters = function (
  string
) {
  return ensureString(string).replace(/[^a-z]/ig, '');
};

/**
 * Reduce a string to its numeric characters.
 */
var extractNumbers = function (
  string
) {
  return ensureString(string).replace(/[^0-9]/g, '');
};

/**
 * Returns a lowercase string.
 */
var lower = function (
  object
) {
  return ensureString(object).toLowerCase();
};

/**
 * Returns an uppercase string.
 */
var upper = function (
  object
) {
  return ensureString(object).toUpperCase();
};

/**
 * Return an escaped value for URLs.
 */
var escape = function (value) {
  return encodeURIComponent(value);
};

/**
 * Return an unescaped value from an escaped URL.
 */
var unescape = function (value) {
  return decodeURIComponent(value);
};

/**
 * Returns a query string generated by serializing an object and joined using a delimiter (defaults to '&')
 */
var buildQueryString = function (
  object
) {
  var queryParams = [];
  forIn(object, function(key, value) {
    queryParams.push(escape(key) + '=' + escape(value));
  });
  return queryParams.join('&');
};

/**
 * Return the browser version if the browser name matches or zero if it doesn't.
 */
var getBrowserVersionOrZero = function (
  browserName
) {
  var match = new RegExp(browserName + '[ /](\\d+(\\.\\d+)?)', 'i').exec(navigator.userAgent);
  return match ? +match[1] : 0;
};
/**
 * Return true if a variable is a given type.
 */
var isType = function (
  value, // mixed:  The variable to check.
  type   // string: The type we're checking for.
) {
  return typeof value == type;
};

/**
 * Return true if a variable is undefined.
 */
var isUndefined = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'undefined');
};

/**
 * Return true if a variable is boolean.
 */
var isBoolean = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'boolean');
};

/**
 * Return true if a variable is a number.
 */
var isNumber = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'number');
};

/**
 * Return true if a variable is a string.
 */
var isString = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'string');
};

/**
 * Return true if a variable is a function.
 */
var isFunction = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'function');
};

/**
 * Return true if a variable is an object.
 */
var isObject = function (
  value // mixed:  The variable to check.
) {
  return isType(value, 'object');
};

/**
 * Return true if a variable is an instance of a class.
 */
var isInstance = function (
  value,     // mixed:  The variable to check.
  protoClass // Class|: The class we'ere checking for.
) {
  return value instanceof (protoClass || Object);
};

/**
 * Return true if a variable is an array.
 */
var isArray = function (
  value // mixed:  The variable to check.
) {
  return isInstance(value, Array);
};

/**
 * Return true if a variable is a date.
 */
var isDate = function (
  value // mixed:  The variable to check.
) {
  return isInstance(value, Date);
};
/**
 * This file is used in conjunction with Jymin to form the Beams Beams.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-Beams.js which includes required Jymin functions.
 */

var BEAMS_RETRY_TIMEOUT = 1e3;

/**
 * "Beams" is a singleton function, on the window, decorated as an object.
 */
var Beams = function () {

  // Once Beams is invoked, it is accessible from outside, even when minified.
  window.Beams = Beams;

  // If we've already decorated the singleton, don't do it again.
  if (Beams._ON) {
    return Beams;
  }

  //+env:debug
  log('[Beams] Initializing client.');
  //-env:debug

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpointUrl = serverUrl;

  // Until we connect, queue emissions.
  var emissions = [];

  // When a message is received, its list of callbacks can be looked up by message name.
  var callbacks = {};

  // If onReady gets called more than once, reset callbacks.
  // When used with D6, calls to "Beams.on" should be inside onReady callbacks.
  var hasRendered = false;
  onReady(function () {
    if (hasRendered) {
      callbacks = {connect: onConnect};
    }
    hasRendered = true;
  });

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  /**
   * Listen for messages from the server.
   */
  Beams._ON = Beams.on = function (name, callback) {
    //+env:debug
    log('[Beams] Listening for "' + name + '".');
    //-env:debug

    var list = callbacks[name];
    if (!list) {
      list = callbacks[name] = [];
    }
    push(list, callback);
    return Beams;
  };

  /**
   * Listen for messages from the server.
   */
  Beams._HANDLE = Beams.handle = function (name, callback) {
    //+env:debug
    log('[Beams] Listening for "' + name + '" with a singular handler.');
    //-env:debug
    callbacks[name] = [callback];
    return Beams;
  };

  /**
   * Listen for "connect" messages.
   */
  Beams._CONNECT = Beams.connect = function (callback) {
    Beams._ON('connect', callback);
    return Beams;
  };

  /**
   * Emit a message to the server via XHR POST.
   */
  Beams._EMIT = Beams.emit = function (name, data) {
    data = stringify(data || {}, 1);

    //+env:debug
    log('[Beams] Emitting "' + name + '": ' + data + '.');
    //-env:debug

    // The server can use the count for sequencing.
    n++;
    // Try to emit data to the server.
    function send() {
      getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        'd=' + escape(data),
        // On success, there's nothing we need to do.
        doNothing,
        // On failure, retry.
        function () {
          setTimeout(send, BEAMS_RETRY_TIMEOUT);
        }
      );
    }
    if (Beams.id) {
      send();
    }
    else {
      emissions.push(send);
    }
    return Beams;
  };

  /**
   * Poll for new messages.
   */
  function poll() {
    //+env:debug
    log('[Beams] Polling for messages at "' + endpointUrl + '".');
    //-env:debug
    getResponse(endpointUrl, onSuccess, onFailure);
  }

  /**
   * On success, iterate through messages, triggering events.
   */
  function onSuccess(messages) {
    forEach(messages, function (message) {
      var name = message[0];
      var data = message[1];
      triggerCallbacks(name, data);
    });
    // Poll again.
    addTimeout(Beams, poll, 0);
  }

  /**
   * On failure, log if in a debug environment, and try again later.
   */
  function onFailure(response) {
    // Try again later.
    addTimeout(Beams, poll, BEAMS_RETRY_TIMEOUT);
    //+env:debug
    error('[Beams] Failed to connect to "' + endpointUrl + '".');
    //-env:debug
  }

  /**
   * Trigger any matching callbacks with received data.
   */
  function triggerCallbacks(name, data) {
    //+env:debug
    log('[Beams] Received "' + name + '": ' + stringify(data) + '.');
    //-env:debug
    forEach(callbacks[name], function (callback) {
      if (isFunction(callback)) {
        callback.call(Beams, data);
      }
      else {
        //+env:debug
        error('[Beams] Handler for "' + name + '" is not a function: ' + stringify(callback) + '.');
        //-env:debug
      }
    });
  }

  /**
   * When we connect, set the client ID.
   */
  function onConnect(data) {
    Beams.id = data.id;
    endpointUrl = serverUrl + '?id=' + Beams.id;
    //+env:debug
    log('[Beams] Set endpoint URL to "' + endpointUrl + '".');
    //-env:debug

    // Now that we have the client ID, we can emit anything we had queued.
    forEach(emissions, function (send) {
      send();
    });
    emissions = [];
  }

  Beams._CONNECT(onConnect);

  // Start polling.
  poll();

  return Beams;
};

window.Beams = Beams;
