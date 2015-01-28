/**
 *  ____                              ____ _ _            _            ___   _   _
 * | __ )  ___  __ _ _ __ ___  ___   / ___| (_) ___ _ __ | |_  __   __/ _ \ / | / |
 * |  _ \ / _ \/ _` | '_ ` _ \/ __| | |   | | |/ _ \ '_ \| __| \ \ / / | | || | | |
 * | |_) |  __/ (_| | | | | | \__ \ | |___| | |  __/ | | | |_   \ V /| |_| || |_| |
 * |____/ \___|\__,_|_| |_| |_|___/  \____|_|_|\___|_| |_|\__|   \_/  \___(_)_(_)_|
 *
 *
 * http://lighter.io/beams
 * MIT License
 *
 * Source files:
 *   https://github.com/lighterio/jymin/blob/master/scripts/ajax.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/arrays.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/dates.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/emitter.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/logging.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/objects.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/strings.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/types.js
 *   https://github.com/lighterio/beams/blob/master/scripts/beams-jymin.js
 */


/**
 * Empty handler.
 * @type {function}
 */
Jymin.doNothing = function () {};

/**
 * Default AJAX success handler function.
 * @type {function}
 */
Jymin.responseSuccessFn = Jymin.doNothing;

/**
 * Default AJAX failure handler function.
 * @type {function}
 */
Jymin.responseFailureFn = Jymin.doNothing;

/**
 * Get an XMLHttpRequest object (or ActiveX object in old IE).
 *
 * @return {XMLHttpRequest}   The request object.
 */
Jymin.getXhr = function () {
  var Xhr = window.XMLHttpRequest;
  var ActiveX = window.ActiveXObject;
  return Xhr ? new Xhr() : (ActiveX ? new ActiveX('Microsoft.XMLHTTP') : false);
};

/**
 * Get an XMLHttpRequest upload object.
 *
 * @return {XMLHttpRequestUpload}   The request upload object.
 */
Jymin.getUpload = function () {
  var xhr = Jymin.getXhr();
  return xhr ? xhr.upload : false;
};

/**
 * Make an AJAX request, and handle it with success or failure.
 *
 * @param  {string}   url        A URL from which to request a response.
 * @param  {string}   body       An optional query, which if provided, makes the request a POST.
 * @param  {function} onSuccess  An optional function to run upon success.
 * @param  {function} onFailure  An optional function to run upon failure.
 * @return {boolean}             True if AJAX is supported.
 */
Jymin.getResponse = function (url, body, onSuccess, onFailure) {
  // If the optional body argument is omitted, shuffle it out.
  if (Jymin.isFunction(body)) {
    onFailure = onSuccess;
    onSuccess = body;
    body = 0;
  }
  var request = Jymin.getXhr();
  if (request) {
    onFailure = onFailure || Jymin.responseFailureFn;
    onSuccess = onSuccess || Jymin.responseSuccessFn;
    request.onreadystatechange = function() {
      if (request.readyState == 4) {
        //+env:debug
        Jymin.log('[Jymin] Received response from "' + url + '". (' + Jymin.getResponse._waiting + ' in progress).');
        //-env:debug
        --Jymin.getResponse._waiting;
        var status = request.status;
        var isSuccess = (status == 200);
        var fn = isSuccess ?
          onSuccess || Jymin.responseSuccessFn :
          onFailure || Jymin.responseFailureFn;
        var data = Jymin.parse(request.responseText) || {};
        data._status = status;
        data._request = request;
        fn(data);
      }
    };
    request.open(body ? 'POST' : 'GET', url, true);
    request.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    if (body) {
      request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    }

    // Record the original request URL.
    request._url = url;

    // If it's a post, record the post body.
    if (body) {
      request._body = body;
    }

    // Record the time the request was made.
    request._time = Jymin.getTime();

    // Allow applications to back off when too many requests are in progress.
    Jymin.getResponse._waiting = (Jymin.getResponse._waiting || 0) + 1;

    //+env:debug
    Jymin.log('[Jymin] Sending request to "' + url + '". (' + Jymin.getResponse._waiting + ' in progress).');
    //-env:debug
    request.send(body || null);

  }
  return true;
};
/**
 * Iterate over an array-like collection, and call a function on each value, with
 * the arguments: (value, index, array). Iteration stops if the function returns false.
 *
 * @param  {Array|Object|string}  array  A collection, expected to have indexed items and a length.
 * @param  {Function}             fn     A function to call on each item.
 * @return {Number}                      The number of items iterated over without breaking.
 */
Jymin.forEach = function (array, fn) {
  if (array) {
    for (var index = 0, length = Jymin.getLength(array); index < length; index++) {
      var result = fn(array[index], index, array);
      if (result === false) {
        break;
      }
    }
    return index;
  }
};

/**
 * Iterate over an array-like collection, and call a function on each value, with
 * the arguments: (index, value, array). Iteration stops if the function returns false.
 *
 * @param  {Array|Object|string}     array  A collection, expected to have indexed items and a length.
 * @param  {Function}  fn                   A function to call on each item.
 * @return {Number}                         The number of items iterated over without breaking.
 */
Jymin.each = function (array, fn) {
  if (array) {
    for (var index = 0, length = Jymin.getLength(array); index < length; index++) {
      var result = fn(index, array[index], array);
      if (result === false) {
        break;
      }
    }
    return index;
  }
};

/**
 * Get the length of an Array/Object/string/etc.
 *
 * @param {Array|Object|string}  array  A collection, expected to have a length.
 * @return {Number}                     The length of the collection.
 */
Jymin.getLength = function (array) {
  return (array || 0).length || 0;
};

/**
 * Get the first item in an Array/Object/string/etc.
 * @param {Array|Object|string}  array  A collection, expected to have index items.
 * @return {Object}                     The first item in the collection.
 */
Jymin.getFirst = function (array) {
  return (array || 0)[0];
};

/**
 * Get the last item in an Array/Object/string/etc.
 *
 * @param {Array|Object|string}  array  A collection, expected to have indexed items and a length.
 * @return {Object}                     The last item in the collection.
 */
Jymin.getLast = function (array) {
  return (array || 0)[Jymin.getLength(array) - 1];
};

/**
 * Check for the existence of more than one collection items.
 *
 * @param {Array|Object|string}   array  A collection, expected to have a length.
 * @return {boolean}                     True if the collection has more than one item.
 */
Jymin.hasMany = function (array) {
  return Jymin.getLength(array) > 1;
};

/**
 * Push an item into an array.
 *
 * @param  {Array}  array  An array to push an item into.
 * @param  {Object} item   An item to push.
 * @return {Object}        The item that was pushed.
 */
Jymin.push = function (array, item) {
  if (Jymin.isArray(array)) {
    array.push(item);
  }
  return item;
};

/**
 * Pop an item off an array.
 *
 * @param  {Array}  array  An array to pop an item from.
 * @return {Object}        The item that was popped.
 */
Jymin.pop = function (array) {
  if (Jymin.isArray(array)) {
    return array.pop();
  }
};

/**
 * Merge one or more arrays into an array.
 *
 * @param  {Array}     array  An array to merge into.
 * @params {Array...}         Items to merge into the array.
 * @return {Array}            The first array argument, with new items merged in.
 */
Jymin.merge = function (array) {
  Jymin.forEach(arguments, function (items, index) {
    if (index) {
      Jymin.forEach(items, function (item) {
        Jymin.push(array, item);
      });
    }
  });
  return array;
};

/**
 * Push padding values onto an array up to a specified length.
 *
 * @return number:
 * @param  {Array}  array        An array to pad.
 * @param  {Number} padToLength  A desired length for the array, after padding.
 * @param  {Object} paddingValue A value to use as padding.
 * @return {Number}              The number of padding values that were added.
 */
Jymin.padArray = function (array, padToLength, paddingValue) {
  var countAdded = 0;
  if (Jymin.isArray(array)) {
    var startingLength = Jymin.getLength(array);
    if (startingLength < length) {
      paddingValue = Jymin.isUndefined(paddingValue) ? '' : paddingValue;
      for (var index = startingLength; index < length; index++) {
        Jymin.push(array, paddingValue);
        countAdded++;
      }
    }
  }
  return countAdded;
};
/**
 * Get Unix epoch milliseconds from a date.
 *
 * @param {Date}    date  Date object (default: now).
 * @return {Number}       Epoch milliseconds.
 */
Jymin.getTime = function (date) {
  return (date || new Date()).getTime();
};

/**
 * Get an ISO-standard date string (even in super duper old browsers).
 *
 * @param {Date}    date  Date object (default: now).
 * @return {String}       ISO date string.
 */
Jymin.getIsoDate = function (date) {
  date = date || new Date();
  if (date.toISOString) {
    date = date.toISOString();
  }
  else {
    // Build an ISO date string manually in really old browsers.
    var utcPattern = /^.*?(\d+) (\w+) (\d+) ([\d:]+).*?$/;
    date = date.toUTCString().replace(utcPattern, function (a, d, m, y, t) {
      m = Jymin.zeroFill(date.getMonth(), 2);
      t += '.' + Jymin.zeroFill(date.getMilliseconds(), 3);
      return y + '-' + m + '-' + d + 'T' + t + 'Z';
    });
  }
  return date;
};

/**
 * Take a date and return something like: "August 26, 2014 at 7:42pm".
 *
 * @param  {Object}   date  Date object or constructor argument.
 * @return {String}         Long formatted date string.
 */
Jymin.formatLongDate = function (date) {
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  Jymin.isDate(date) ? 0 : (date = new Date(+date || date));
  var m = MONTHS[date.getMonth()];
  var isAm = true;
  var h = +date.getHours();
  var minutes = date.getMinutes();
  minutes = minutes > 9 ? minutes : "0" + minutes;
  h > 12 ? (isAm = false, h -= 12) : (h === 0 ? h = 12 : 0);
  return m + " " + date.getDate() + ", " + date.getFullYear() + " at " + h +
    ":" + minutes + (isAm ? "am" : "pm");
}

/**
 * Take a date, and return something like: "8/26/14 7:42pm".
 *
 * @param  {Object}   date  Date object or constructor argument.
 * @return {String}         Short formatted date string.
 */
Jymin.formatShortDate = function (date) {
  Jymin.isDate(date) ? 0 : (date = new Date(+date || date));
  var m = date.getMonth() + 1;
  var isAm = true;
  var h = +date.getHours();
  var minutes = date.getMinutes();
  minutes = minutes > 9 ? minutes : "0" + minutes;
  h > 12 ? (isAm = false, h -= 12) : (h === 0 ? h = 12 : 0);
  return m + "/" + date.getDate() + "/" + date.getFullYear() % 100 + " " + h +
    ":" + minutes + (isAm ? "am" : "pm");
}
/**
 * An Emitter is an EventEmitter-style object.
 */
Jymin.Emitter = function () {
  // Lazily apply the prototype so that Emitter can minify out if not used.
  // TODO: Find out if this is still necessary with UglifyJS.
  Jymin.Emitter.prototype = Jymin.EmitterPrototype;
};

/**
 * Expose Emitter methods which can be applied lazily.
 */
Jymin.EmitterPrototype = {

  _on: function (event, fn) {
    var self = this;
    var events = self._events || (self._events = {});
    var listeners = events[event] || (events[event] = []);
    listeners.push(fn);
    return self;
  },

  _once: function (event, fn) {
    var self = this;
    function f() {
      fn.apply(self, arguments);
      self._removeListener(event, f);
    }
    self._on(event, f);
    return self;
  },

  _emit: function (event) {
    var self = this;
    var listeners = self._listeners(event);
    var args = Array.prototype.slice.call(arguments, 1);
    Jymin.forEach(listeners, function (listener) {
      listener.apply(self, args);
    });
    return self;
  },

  _listeners: function (event) {
    var self = this;
    var events = self._events || 0;
    var listeners = events[event] || [];
    return listeners;
  },

  _removeListener: function (event, fn) {
    var self = this;
    var listeners = self._listeners(event);
    var i = listeners.indexOf(fn);
    if (i > -1) {
      listeners.splice(i, 1);
    }
    return self;
  },

  _removeAllListeners: function (event, fn) {
    var self = this;
    var events = self._events || {};
    if (event) {
      delete events[event];
    }
    else {
      for (event in events) {
        delete events[event];
      }
    }
    return self;
  }

};
/**
 * Log values to the console, if it's available.
 */
Jymin.error = function () {
  Jymin.ifConsole('Jymin.error', arguments);
};

/**
 * Log values to the console, if it's available.
 */
Jymin.warn = function () {
  Jymin.ifConsole('Jymin.warn', arguments);
};

/**
 * Log values to the console, if it's available.
 */
Jymin.info = function () {
  Jymin.ifConsole('Jymin.info', arguments);
};

/**
 * Log values to the console, if it's available.
 */
Jymin.log = function () {
  Jymin.ifConsole('Jymin.log', arguments);
};

/**
 * Log values to the console, if it's available.
 */
Jymin.trace = function () {
  Jymin.ifConsole('Jymin.trace', arguments);
};

/**
 * Log values to the console, if it's available.
 */
Jymin.ifConsole = function (method, args) {
  var console = window.console;
  if (console && console[method]) {
    console[method].apply(console, args);
  }
};
/**
 * Iterate over an object's keys, and call a function on each key value pair.
 */
Jymin.forIn = function (object, callback) {
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
Jymin.forOf = function (object, callback) {
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
 * Decorate an object with properties from another object.
 */
Jymin.decorateObject = function (object, decorations) {
  if (object && decorations) {
    Jymin.forIn(decorations, function (key, value) {
      object[key] = value;
    });
  }
  return object;
};

/**
 * Ensure that a property exists by creating it if it doesn't.
 */
Jymin.ensureProperty = function (object, property, defaultValue) {
  var value = object[property];
  if (!value) {
    value = object[property] = defaultValue;
  }
  return value;
};
/**
 * Ensure a value is a string.
 */
Jymin.ensureString = function (
  value
) {
  return Jymin.isString(value) ? value : '' + value;
};

/**
 * Return true if the string contains the given substring.
 */
Jymin.contains = function (
  string,
  substring
) {
  return Jymin.ensureString(string).indexOf(substring) > -1;
};

/**
 * Return true if the string starts with the given substring.
 */
Jymin.startsWith = function (
  string,
  substring
) {
  return Jymin.ensureString(string).indexOf(substring) == 0; // jshint ignore:line
};

/**
 * Trim the whitespace from a string.
 */
Jymin.trim = function (
  string
) {
  return Jymin.ensureString(string).replace(/^\s+|\s+$/g, '');
};

/**
 * Split a string by commas.
 */
Jymin.splitByCommas = function (
  string
) {
  return Jymin.ensureString(string).split(',');
};

/**
 * Split a string by spaces.
 */
Jymin.splitBySpaces = function (
  string
) {
  return Jymin.ensureString(string).split(' ');
};

/**
 * Return a string, with asterisks replaced by values from a replacements array.
 */
Jymin.decorateString = function (
  string,
  replacements
) {
  string = Jymin.ensureString(string);
  Jymin.forEach(replacements, function(replacement) {
    string = string.replace('*', replacement);
  });
  return string;
};

/**
 * Perform a RegExp Jymin.match, and call a callback on the result;
  */
Jymin.match = function (
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
Jymin.extractLetters = function (
  string
) {
  return Jymin.ensureString(string).replace(/[^a-z]/ig, '');
};

/**
 * Reduce a string to its numeric characters.
 */
Jymin.extractNumbers = function (
  string
) {
  return Jymin.ensureString(string).replace(/[^0-9]/g, '');
};

/**
 * Returns a lowercase string.
 */
Jymin.lower = function (
  object
) {
  return Jymin.ensureString(object).toLowerCase();
};

/**
 * Returns an uppercase string.
 */
Jymin.upper = function (
  object
) {
  return Jymin.ensureString(object).toUpperCase();
};

/**
 * Return an escaped value for URLs.
 */
Jymin.escape = function (value) {
  return encodeURIComponent(value);
};

/**
 * Return an unescaped value from an escaped URL.
 */
Jymin.unescape = function (value) {
  return decodeURIComponent(value);
};

/**
 * Returns a query string generated by serializing an object and joined using a delimiter (defaults to '&')
 */
Jymin.buildQueryString = function (
  object
) {
  var queryParams = [];
  Jymin.forIn(object, function(key, value) {
    queryParams.push(Jymin.escape(key) + '=' + Jymin.escape(value));
  });
  return queryParams.join('&');
};

/**
 * Return the browser version if the browser name matches or zero if it doesn't.
 */
Jymin.getBrowserVersionOrZero = function (
  browserName
) {
  match = new RegExp(browserName + '[ /](\\d+(\\.\\d+)?)', 'i').exec(navigator.userAgent);
  return match ? +Jymin.match[1] : 0;
};
/**
 * Return true if a variable is a given type.
 */
Jymin.isType = function (
  value, // mixed:  The variable to check.
  type   // string: The type we're checking for.
) {
  return typeof value == type;
};

/**
 * Return true if a variable is undefined.
 */
Jymin.isUndefined = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'undefined');
};

/**
 * Return true if a variable is boolean.
 */
Jymin.isBoolean = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'boolean');
};

/**
 * Return true if a variable is a number.
 */
Jymin.isNumber = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'number');
};

/**
 * Return true if a variable is a string.
 */
Jymin.isString = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'string');
};

/**
 * Return true if a variable is a function.
 */
Jymin.isFunction = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'function');
};

/**
 * Return true if a variable is an object.
 */
Jymin.isObject = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isType(value, 'object');
};

/**
 * Return true if a variable is an instance of a class.
 */
Jymin.isInstance = function (
  value,     // mixed:  The variable to check.
  protoClass // Class|: The class we'ere checking for.
) {
  return value instanceof (protoClass || Object);
};

/**
 * Return true if a variable is an array.
 */
Jymin.isArray = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isInstance(value, Array);
};

/**
 * Return true if a variable is a date.
 */
Jymin.isDate = function (
  value // mixed:  The variable to check.
) {
  return Jymin.isInstance(value, Date);
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
  if (Beams._on) {
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

  // When a message is received, its handlers can be looked up by message name.
  var events = Beams._events = {};

  // If onReady gets called more than once, reset events.
  // When used with D6, calls to "Beams._on" should be inside onReady events.
  var hasRendered = false;
  onReady(function () {
    if (hasRendered) {
      events = Beams._events = {connect: onConnect};
    }
    hasRendered = true;
  });

  // Add the Emitter prototype methods to Beams.
  decorateObject(Beams, EmitterPrototype);

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  /**
   * Listen for messages from the server.
   */
  Beams._on = function (name, callback) {
    //+env:debug
    log('[Beams] Listening for "' + name + '".');
    //-env:debug
    var list = events[name] || (events[name] = []);
    push(list, callback);
    return Beams;
  };

  /**
   * Listen for "connect" messages.
   */
  Beams._connect = function (callback) {
    Beams._on('connect', callback);
    return Beams;
  };

  /**
   * Emit a message to the server via XHR POST.
   */
  Beams._emit = function (name, data) {
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
    if (Beams._id) {
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
   * Trigger any matching events with received data.
   */
  function triggerCallbacks(name, data) {
    //+env:debug
    log('[Beams] Received "' + name + '": ' + stringify(data) + '.');
    //-env:debug
    forEach(events[name], function (callback) {
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
    Beams._id = data.id;
    endpointUrl = serverUrl + '?id=' + Beams._id;
    //+env:debug
    log('[Beams] Set endpoint URL to "' + endpointUrl + '".');
    //-env:debug

    // Now that we have the client ID, we can emit anything we had queued.
    forEach(emissions, function (send) {
      send();
    });
    emissions = [];
  }

  Beams._connect(onConnect);

  // Start polling.
  poll();

  return Beams;
};

window.Beams = Beams;
