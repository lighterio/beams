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
 *   https://github.com/lighterio/beams/blob/master/scripts/beams-jymin.js
 *   https://github.com/lighterio/jymin/blob/master/jymin.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/ajax.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/arrays.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/cookies.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/crypto.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/dates.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/dom.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/emitter.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/events.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/forms.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/functions.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/history.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/i18n.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/json.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/logging.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/move.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/numbers.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/objects.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/ready.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/regexp.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/storage.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/strings.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/timing.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/types.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/url.js
 */


/**
 * This file is used in conjunction with Jymin to form the Beams client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../beams-client.js which includes required Jymin functions.
 *
 * @uses jymin/jymin.js
 */

var Beams = (function () {

  //+env:debug
  Jymin.log('[Beams] Initializing client.');
  //-env:debug

  // The beams server listens for GET and POST requests at /beam.
  var serverUrl = '/beam';
  var endpointUrl = serverUrl;
  var retryTimeout = 1e3;

  // Until we connect, queue emissions.
  var emissions = [];

  // The Beams object is an event emitter.
  var Beams = new Jymin.Emitter();

  // Keep a count of emissions so the server can de-duplicate.
  var n = 0;

  // When we receive something from the server, emit it internally.
  Beams._receive = Beams._emit;

  /**
   * Emit a message to the server via XHR POST.
   */
  Beams._emit = function (name, data) {
    data = Jymin.stringify(data || {});

    //+env:debug
    Jymin.log('[Beams] Emitting "' + name + '": ' + data + '.');
    //-env:debug

    // The server can use the count for sequencing.
    n++;

    // Try to emit data to the server.
    function send() {
      Jymin.getResponse(
        // Send the event name and emission number as URL params.
        endpointUrl + '&m=' + Jymin.escape(name) + '&n=' + n,
        // Send the message data as POST body so we're not size-limited.
        'd=' + Jymin.escape(data),
        // On success, there's nothing we need to do.
        Jymin.doNothing,
        // On failure, retry.
        function () {
          setTimeout(send, retryTimeout);
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
   * When we connect, set the client ID.
   */
  Beams._on('connect', function (data) {
    Beams._id = data.id;
    endpointUrl = serverUrl + '?id=' + Beams._id;
    //+env:debug
    Jymin.log('[Beams] Set endpoint URL to "' + endpointUrl + '".');
    //-env:debug

    // Now that we have the client ID, we can emit anything we had queued.
    Jymin.forEach(emissions, function (send) {
      // TODO: Send queued data in a single request.
      send();
    });
    emissions = [];
  });

  /**
   * Poll for new messages.
   */
  function poll() {
    //+env:debug
    Jymin.log('[Beams] Polling for messages at "' + endpointUrl + '".');
    //-env:debug
    Jymin.getResponse(endpointUrl, onSuccess, onFailure);
  }

  /**
   * On success, iterate through messages, triggering events.
   */
  function onSuccess(messages) {
    Jymin.forEach(messages, function (parts) {
      var name = parts[0];
      var data = parts[1];
      Beams._receive(name, data);
    });
    // Start polling again.
    Jymin.setTimer(Beams, poll, 0);
  }

  /**
   * On failure, log if in a debug environment, and try again later.
   */
  function onFailure() {
    // Try again later.
    Jymin.setTimer(Beams, poll, retryTimeout);
    //+env:debug
    Jymin.error('[Beams] Failed to connect to "' + endpointUrl + '".');
    //-env:debug
  }

  // Start polling.
  poll();

  return Beams;

})();
/**      _                 _                ___  _  _    _
 *      | |_   _ _ __ ___ (_)_ __   __   __/ _ \| || |  / |
 *   _  | | | | | '_ ` _ \| | '_ \  \ \ / / | | | || |_ | |
 *  | |_| | |_| | | | | | | | | | |  \ V /| |_| |__   _|| |
 *   \___/ \__, |_| |_| |_|_|_| |_|   \_/  \___(_) |_|(_)_|
 *         |___/
 *
 * http://lighter.io/jymin
 *
 * If you're seeing this in production, you really should minify.
 *
 * Source files:
 *   https://github.com/lighterio/jymin/blob/master/scripts/ajax.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/arrays.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/cookies.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/crypto.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/dates.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/dom.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/emitter.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/events.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/forms.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/functions.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/history.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/i18n.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/json.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/logging.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/move.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/numbers.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/objects.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/ready.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/regexp.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/storage.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/strings.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/timing.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/types.js
 *   https://github.com/lighterio/jymin/blob/master/scripts/url.js
 */


var Jymin = {version: '0.4.1'};

//+env:commonjs
// Support CommonJS.
if (typeof exports == 'object') {
  module.exports = Jymin;
}
//-env:commonjs

//+env:amd
// Support AMD.
else if (typeof define == 'function' && define.amd) {
  define(function() {
    return Jymin;
  });
}
//-env:amd

//+env:window
// Support browsers.
else {
  this.Jymin = Jymin;
}
//-env:window

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
 * Name of the XMLHttpRequest object.
 * @type {String}
 */
Jymin.XHR = 'XMLHttpRequest';

/**
 * Get an XMLHttpRequest object (or ActiveX object in old IE).
 *
 * @return {XMLHttpRequest}   The request object.
 */
Jymin.getXhr = function () {
  var xhr;


  xhr = new XMLHttpRequest();

  return xhr;
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
    Jymin.bindReady(request, function () {

      //+env:debug
      Jymin.log('[Jymin] Received response from "' + url + '". (' + Jymin.getResponse._waiting + ' in progress).');
      --Jymin.getResponse._waiting;
      //-env:debug

      var status = request.status;
      var isSuccess = (status == 200);
      var fn = isSuccess ?
        onSuccess || Jymin.responseSuccessFn :
        onFailure || Jymin.responseFailureFn;
      var data = Jymin.parse(request.responseText) || {};
      fn(data, request, status);
    });
    request.open(body ? 'POST' : 'GET', url, true);
    if (body) {
      request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    }

    //+env:debug

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
    array = Jymin.isString(array) ? Jymin.splitByCommas(array) : array;
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
    array = Jymin.isString(array) ? Jymin.splitByCommas(array) : array;
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
 * Get all cookies from the document, and return a map.
 *
 * @return {Object}  The map of cookie names and values.
 */
Jymin.getAllCookies = function () {
  var obj = {};
  var documentCookie = Jymin.trim(document.cookie);
  if (documentCookie) {
    var cookies = documentCookie.split(/\s*;\s*/);
    Jymin.forEach(cookies, function (cookie) {
      var pair = cookie.split(/\s*=\s*/);
      obj[Jymin.unescape(pair[0])] = Jymin.unescape(pair[1]);
    });
  }
  return obj;
};

/**
 * Get a cookie by its name.
 *
 * @param  {String} name  A cookie name.
 * @return {String}       The cookie value.
 */
Jymin.getCookie = function (name) {
  return Jymin.getAllCookies()[name];
};

/**
 * Set or overwrite a cookie value.
 *
 * @param {String} name     A cookie name, whose value is to be set.
 * @param {Object} value    A value to be set as a string.
 * @param {Object} options  Optional cookie options, including "maxage", "expires", "path", "domain" and "secure".
 */
Jymin.setCookie = function (name, value, options) {
  options = options || {};
  var str = Jymin.escape(name) + '=' + Jymin.unescape(value);
  if (null === value) {
    options.maxage = -1;
  }
  if (options.maxage) {
    options.expires = new Date(+new Date() + options.maxage);
  }
  document.cookie = str +
    (options.path ? ';path=' + options.path : '') +
    (options.domain ? ';domain=' + options.domain : '') +
    (options.expires ? ';expires=' + options.expires.toUTCString() : '') +
    (options.secure ? ';secure' : '');
};

/**
 * Delete a cookie by name.
 *
 * @param {String} name  A cookie name, whose value is to be deleted.
 */
Jymin.deleteCookie = function (name) {
  Jymin.setCookie(name, null);
};
/**
 * Calculate an MD5 hash for a string (useful for things like Gravatars).
 *
 * @param  {String} s  A string to hash.
 * @return {String}    The MD5 hash for the given string.
 */
Jymin.md5 = function (str) {

  // Encode as UTF-8.
  str = decodeURIComponent(encodeURIComponent(str));

  // Build an array of little-endian words.
  var arr = new Array(str.length >> 2);
  for (var idx = 0, len = arr.length; idx < len; idx += 1) {
    arr[idx] = 0;
  }
  for (idx = 0, len = str.length * 8; idx < len; idx += 8) {
    arr[idx >> 5] |= (str.charCodeAt(idx / 8) & 0xFF) << (idx % 32);
  }

  // Calculate the MD5 of an array of little-endian words.
  arr[len >> 5] |= 0x80 << (len % 32);
  arr[(((len + 64) >>> 9) << 4) + 14] = len;

  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  len = arr.length;
  idx = 0;
  while (idx < len) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    var e = arr[idx++];
    var f = arr[idx++];
    var g = arr[idx++];
    var h = arr[idx++];
    var i = arr[idx++];
    var j = arr[idx++];
    var k = arr[idx++];
    var l = arr[idx++];
    var m = arr[idx++];
    var n = arr[idx++];
    var o = arr[idx++];
    var p = arr[idx++];
    var q = arr[idx++];
    var r = arr[idx++];
    var s = arr[idx++];
    var t = arr[idx++];

    a = ff(a, b, c, d, e, 7, -680876936);
    d = ff(d, a, b, c, f, 12, -389564586);
    c = ff(c, d, a, b, g, 17, 606105819);
    b = ff(b, c, d, a, h, 22, -1044525330);
    a = ff(a, b, c, d, i, 7, -176418897);
    d = ff(d, a, b, c, j, 12, 1200080426);
    c = ff(c, d, a, b, k, 17, -1473231341);
    b = ff(b, c, d, a, l, 22, -45705983);
    a = ff(a, b, c, d, m, 7, 1770035416);
    d = ff(d, a, b, c, n, 12, -1958414417);
    c = ff(c, d, a, b, o, 17, -42063);
    b = ff(b, c, d, a, p, 22, -1990404162);
    a = ff(a, b, c, d, q, 7, 1804603682);
    d = ff(d, a, b, c, r, 12, -40341101);
    c = ff(c, d, a, b, s, 17, -1502002290);
    b = ff(b, c, d, a, t, 22, 1236535329);

    a = gg(a, b, c, d, f, 5, -165796510);
    d = gg(d, a, b, c, k, 9, -1069501632);
    c = gg(c, d, a, b, p, 14, 643717713);
    b = gg(b, c, d, a, e, 20, -373897302);
    a = gg(a, b, c, d, j, 5, -701558691);
    d = gg(d, a, b, c, o, 9, 38016083);
    c = gg(c, d, a, b, t, 14, -660478335);
    b = gg(b, c, d, a, i, 20, -405537848);
    a = gg(a, b, c, d, n, 5, 568446438);
    d = gg(d, a, b, c, s, 9, -1019803690);
    c = gg(c, d, a, b, h, 14, -187363961);
    b = gg(b, c, d, a, m, 20, 1163531501);
    a = gg(a, b, c, d, r, 5, -1444681467);
    d = gg(d, a, b, c, g, 9, -51403784);
    c = gg(c, d, a, b, l, 14, 1735328473);
    b = gg(b, c, d, a, q, 20, -1926607734);

    a = hh(a, b, c, d, j, 4, -378558);
    d = hh(d, a, b, c, m, 11, -2022574463);
    c = hh(c, d, a, b, p, 16, 1839030562);
    b = hh(b, c, d, a, s, 23, -35309556);
    a = hh(a, b, c, d, f, 4, -1530992060);
    d = hh(d, a, b, c, i, 11, 1272893353);
    c = hh(c, d, a, b, l, 16, -155497632);
    b = hh(b, c, d, a, o, 23, -1094730640);
    a = hh(a, b, c, d, r, 4, 681279174);
    d = hh(d, a, b, c, e, 11, -358537222);
    c = hh(c, d, a, b, h, 16, -722521979);
    b = hh(b, c, d, a, k, 23, 76029189);
    a = hh(a, b, c, d, n, 4, -640364487);
    d = hh(d, a, b, c, q, 11, -421815835);
    c = hh(c, d, a, b, t, 16, 530742520);
    b = hh(b, c, d, a, g, 23, -995338651);

    a = ii(a, b, c, d, e, 6, -198630844);
    d = ii(d, a, b, c, l, 10, 1126891415);
    c = ii(c, d, a, b, s, 15, -1416354905);
    b = ii(b, c, d, a, j, 21, -57434055);
    a = ii(a, b, c, d, q, 6, 1700485571);
    d = ii(d, a, b, c, h, 10, -1894986606);
    c = ii(c, d, a, b, o, 15, -1051523);
    b = ii(b, c, d, a, f, 21, -2054922799);
    a = ii(a, b, c, d, m, 6, 1873313359);
    d = ii(d, a, b, c, t, 10, -30611744);
    c = ii(c, d, a, b, k, 15, -1560198380);
    b = ii(b, c, d, a, r, 21, 1309151649);
    a = ii(a, b, c, d, i, 6, -145523070);
    d = ii(d, a, b, c, p, 10, -1120210379);
    c = ii(c, d, a, b, g, 15, 718787259);
    b = ii(b, c, d, a, n, 21, -343485551);

    a = add(a, olda);
    b = add(b, oldb);
    c = add(c, oldc);
    d = add(d, oldd);
  }
  arr = [a, b, c, d];

  // Build a string.
  var hex = '0123456789abcdef';
  str = '';
  for (idx = 0, len = arr.length * 32; idx < len; idx += 8) {
    var code = (arr[idx >> 5] >>> (idx % 32)) & 0xFF;
    str += hex.charAt((code >>> 4) & 0x0F) + hex.charAt(code & 0x0F);
  }

  return str;

  /**
   * Add 32-bit integers, using 16-bit operations to mitigate JS interpreter bugs.
   */
  function add(a, b) {
    var lsw = (a & 0xFFFF) + (b & 0xFFFF);
    var msw = (a >> 16) + (b >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  function cmn(q, a, b, x, s, t) {
    a = add(add(a, q), add(x, t));
    return add((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

};
/**
 * Get Unix epoch milliseconds from a date.
 *
 * @param {Date}    date  An optional Date object (default: now).
 * @return {Number}       Epoch milliseconds.
 */
Jymin.getTime = function (date) {
  return date ? date.getTime() : Date.now();
};

/**
 * Get an ISO-standard date string.
 *
 * @param {Date}    date  Date object (default: now).
 * @return {String}       ISO date string.
 */
Jymin.getIsoDate = function (date) {
  date = date || new Date();

  date = date.toISOString();


  return date;
};

/**
 * Take a date and return a formatted date string in long or short format:
 * - Short: "8/26/14 7:42pm"
 * - Long: "August 26, 2014 at 7:42pm"
 *
 * @param  {Object}  date    An optional Date object or constructor argument.
 * @param  {Boolean} isLong  Whether to output the short or long format.
 * @param  {Boolean} isTime  Whether to append the time.
 * @return {String}          The formatted date string.
 */
Jymin.formatDate = function (date, isLong, isTime) {
  if (!Jymin.isDate(date)) {
    date = new Date(+date || date);
  }
  var m = date.getMonth();
  var day = date.getDate();
  var y = date.getFullYear();
  if (isLong) {
    m = Jymin.i18nMonths[m];
  }
  else {
    m++;
    y = ('' + y).substr(2);
  }
  var isAm = 1;
  var hour = +date.getHours();
  var minute = date.getMinutes();
  minute = minute > 9 ? minute : '0' + minute;
  if (!Jymin.i18n24Hour) {
    if (hour > 12) {
      isAm = 0;
      hour -= 12;
    }
    else if (!hour) {
      hour = 12;
    }
  }
  var string;
  if (Jymin.i18nDayMonthYear) {
    string = m;
    m = day;
    day = string;
  }
  if (isLong) {
    string = m + ' ' + day + ', ' + y;
  }
  else {
    string = m + '/' + day + '/' + y;
  }
  if (isTime) {
    if (isLong) {
      string += ' ' + Jymin.i18nAt;
    }
    string += ' ' + hour + ':' + minute;
    if (Jymin.i18n24Hour) {
      string += (isAm ? 'am' : 'pm');
    }
  }
  return string;
};

/**
 * Taka a date object and return a formatted time string.
 *
 * @param  {Object}  date    An optional Date object or constructor argument.
 * @return {[type]}
 */
Jymin.formatTime = function (date) {
  date = Jymin.formatDate(date).replace(/^.* /, '');
};
/**
 * Get an element by its ID (if the argument is an ID).
 * If you pass in an element, it just returns it.
 * This can be used to ensure that you have an element.
 *
 * @param  {HTMLElement}        parentElement  Optional element to call getElementById on (default: document).
 * @param  {string|HTMLElement} idOrElement    ID of an element, or the element itself.
 * @return {HTMLElement}                       The matching element, or undefined.
 */
Jymin.getElement = function (parentElement, idOrElement) {
  if (!Jymin.hasMany(arguments)) {
    idOrElement = parentElement;
    parentElement = document;
  }
  return Jymin.isString(idOrElement) ? parentElement.getElementById(idOrElement) : idOrElement;
};

/**
 * Get the parent of an element, or an ancestor with a specified tag name.
 *
 * @param  {HTMLElement} element   A element whose parent elements are being searched.
 * @param  {String}      selector  An optional selector to search up the tree.
 * @return {HTMLElement}           The parent or matching ancestor.
 */
Jymin.getParent = function (element, selector) {
  return Jymin.getTrail(element, selector)[1];
};

/**
 * Get the trail that leads back to the root, optionally filtered by a selector.
 *
 * @param  {HTMLElement} element   An element to start the trail.
 * @param  {String}      selector  An optional selector to filter the trail.
 * @return {Array}                 The array of elements in the trail.
 */
Jymin.getTrail = function (element, selector) {
  var trail = [element];
  while (element = element.parentNode) { // jshint ignore:line
    Jymin.push(trail, element);
  }
  if (selector) {
    var set = trail;
    trail = [];
    Jymin.all(selector, function (element) {
      if (set.indexOf(element) > -1) {
        Jymin.push(trail, element);
      }
    });
  }
  return trail;
};

/**
 * Get the children of a parent element.
 *
 * @param  {HTMLElement}    element  A parent element who might have children.
 * @return {HTMLCollection}          The collection of children.
 */
Jymin.getChildren = function (element) {
  return element.childNodes;
};

/**
 * Get an element's index with respect to its parent.
 *
 * @param  {HTMLElement} element  An element with a parent, and potentially siblings.
 * @return {Number}               The element's index, or -1 if there's no matching element.
 */
Jymin.getIndex = function (element) {
  var index = -1;
  while (element) {
    ++index;
    element = element.previousSibling;
  }
  return index;
};

/**
 * Get an element's first child.
 *
 * @param  {HTMLElement} element  An element.
 * @return {[type]}               The element's first child.
 */
Jymin.getFirstChild = function (element) {
  return element.firstChild;
};

/**
 * Get an element's previous sibling.
 *
 * @param  {HTMLElement} element  An element.
 * @return {HTMLElement}          The element's previous sibling.
 */
Jymin.getPreviousSibling = function (element) {
  return element.previousSibling;
};

/**
 * Get an element's next sibling.
 *
 * @param  {HTMLElement} element  An element.
 * @return {HTMLElement}          The element's next sibling.
 */
Jymin.getNextSibling = function (element) {
  return element.nextSibling;
};

/**
 * Create a cloneable element with a specified tag name.
 *
 * @param  {String}      tagName  An optional tag name (default: div).
 * @return {HTMLElement}          The newly-created DOM Element with the specified tag name.
 */
Jymin.createTag = function (tagName) {
  tagName = tagName || 'div';
  var isSvg = /^(svg|g|path|circle|line)$/.test(tagName);
  var uri = 'http://www.w3.org/' + (isSvg ? '2000/svg' : '1999/xhtml');
  return document.createElementNS(uri, tagName);
};

/**
 * Create an element, given a specified tag identifier.
 *
 * Identifiers are of the form:
 *   tagName#id.class1.class2?attr1=value1&attr2=value2
 *
 * Each part of the identifier is optional.
 *
 * @param  {HTMLElement|String} elementOrString  An element or a string used to create an element (default: div).
 * @param  {String}             innerHtml        An optional string of HTML to populate the element.
 * @return {HTMLElement}                         The existing or created element.
 */
Jymin.createElement = function (elementOrString, innerHtml) {
  var element = elementOrString;
  if (Jymin.isString(elementOrString)) {
    var tagAndAttributes = elementOrString.split('?');
    var tagAndClass = tagAndAttributes[0].split('.');
    var className = tagAndClass.slice(1).join(' ');
    var tagAndId = tagAndClass[0].split('#');
    var tagName = tagAndId[0];
    var id = tagAndId[1];
    var attributes = tagAndAttributes[1];
    var cachedElement = Jymin.createTag[tagName] || (Jymin.createTag[tagName] = Jymin.createTag(tagName));
    element = cachedElement.cloneNode(true);
    if (id) {
      element.id = id;
    }
    if (className) {
      element.className = className;
    }
    // TODO: Do something less janky than using query string syntax (Maybe like Ltl?).
    if (attributes) {
      attributes = attributes.split('&');
      Jymin.forEach(attributes, function (attribute) {
        var keyAndValue = attribute.split('=');
        var key = Jymin.unescape(keyAndValue[0]);
        var value = Jymin.unescape(keyAndValue[1]);
        element[key] = value;
        element.setAttribute(key, value);
      });
    }
    if (innerHtml) {
      Jymin.setHtml(element, innerHtml);
    }
  }
  return element;
};

/**
 * Add an element to a parent element, creating it first if necessary.
 *
 * @param  {HTMLElement}        parentElement    An optional parent element (default: document).
 * @param  {HTMLElement|String} elementOrString  An element or a string used to create an element (default: div).
 * @param  {String}             innerHtml        An optional string of HTML to populate the element.
 * @return {HTMLElement}                         The element that was added.
 */
Jymin.addElement = function (parentElement, elementOrString, innerHtml) {
  if (Jymin.isString(parentElement)) {
    elementOrString = parentElement;
    parentElement = document;
  }
  var element = Jymin.createElement(elementOrString, innerHtml);
  parentElement.appendChild(element);
  return element;
};

/**
 * Insert a child element under a parent element, optionally before another element.
 *
 * @param  {HTMLElement}         parentElement    An optional parent element (default: document).
 * @param  {HTMLElement|String}  elementOrString  An element or a string used to create an element (default: div).
 * @param  {HTMLElement}         beforeSibling    An optional child to insert the element before.
 * @return {HTMLElement}                          The element that was inserted.
 */
Jymin.insertElement = function (parentElement, elementOrString, beforeSibling) {
  if (Jymin.isString(parentElement)) {
    beforeSibling = elementOrString;
    elementOrString = parentElement;
    parentElement = document;
  }
  var element = Jymin.createElement(elementOrString);
  if (parentElement) {
    // If the beforeSibling value is a number, get the (future) sibling at that index.
    if (Jymin.isNumber(beforeSibling)) {
      beforeSibling = Jymin.getChildren(parentElement)[beforeSibling];
    }
    // Insert the element, optionally before an existing sibling.
    parentElement.insertBefore(element, beforeSibling || Jymin.getFirstChild(parentElement) || null);
  }
  return element;
};

/**
 * Wrap an element with another element.
 *
 * @param  {HTMLElement}        innerElement  An element to wrap with another element.
 * @param  {HTMLElement|String} outerElement  An element or a string used to create an element (default: div).
 * @return {HTMLElement}                      The element that was created as a wrapper.
 */
Jymin.wrapElement = function (innerElement, outerElement) {
  var parentElement = Jymin.getParent(innerElement);
  outerElement = Jymin.insertElement(parentElement, outerElement, innerElement);
  Jymin.insertElement(outerElement, innerElement);
  return outerElement;
};

/**
 * Remove an element from its parent.
 *
 * @param  {HTMLElement} element  An element to remove.
 */
Jymin.removeElement = function (element) {
  if (element) {
    // Remove the element from its parent, provided that it has a parent.
    var parentElement = Jymin.getParent(element);
    if (parentElement) {
      parentElement.removeChild(element);
    }
  }
};

/**
 * Remove children from an element.
 *
 * @param  {HTMLElement} element  An element whose children should all be removed.
 */
Jymin.clearElement = function (element) {
  Jymin.setHtml(element, '');
};

/**
 * Get an element's inner HTML.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's HTML.
 */
Jymin.getHtml = function (element) {
  return element.innerHTML;
};

/**
 * Set an element's inner HTML.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      html     A string of HTML to set as the innerHTML.
 */
Jymin.setHtml = function (element, html) {
  element.innerHTML = html;
};

/**
 * Get an element's lowercase tag name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's tag name.
 */
Jymin.getTag = function (element) {
  return Jymin.lower(element.tagName);
};

/**
 * Get an element's text.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's text content.
 */
Jymin.getText = function (element) {
  return element.textContent || element.innerText;
};

/**
 * Set the text of an element.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}      text     A text string to set.
 */
Jymin.setText = function (element, text) {
  Jymin.clearElement(element);
  Jymin.addText(element, text);
};

/**
 * Add text to an element.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}      text     A text string to add.
 */
Jymin.addText = function (element, text) {
  Jymin.addElement(element, document.createTextNode(text));
};

/**
 * Get an attribute from an element.
 *
 * @param  {HTMLElement} element        An element.
 * @param  {String}      attributeName  An attribute's name.
 * @return {String}                     The value of the attribute.
 */
Jymin.getAttribute = function (element, attributeName) {
  return element.getAttribute(attributeName);
};

/**
 * Set an attribute on an element.
 *
 * @param  {HTMLElement} element        An element.
 * @param  {String}      attributeName  An attribute name.
 * @param  {String}      value          A value to set the attribute to.
 */
Jymin.setAttribute = function (element, attributeName, value) {
  element.setAttribute(attributeName, value);
};

/**
 * Get a data attribute from an element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      dataKey  A data attribute's key.
 * @return {String}               The value of the data attribute.
 */
Jymin.getData = function (element, dataKey) {
  return Jymin.getAttribute(element, 'data-' + dataKey);
};

/**
 * Set a data attribute on an element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      dataKey  A data attribute key.
 * @param  {String}      value    A value to set the data attribute to.
 */
Jymin.setData = function (element, dataKey, value) {
  Jymin.setAttribute(element, 'data-' + dataKey, value);
};

/**
 * Get an element's class name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's class name.
 */
Jymin.getClass = function (element) {
  var className = element.className || '';
  return className.baseVal || className;
};

/**
 * Get an element's class name as an array of classes.
 *
 * @param  {HTMLElement} element  An element.
 * @return {Array}                The element's class name classes.
 */
Jymin.getClasses = function (element) {
  return Jymin.getClass(element).split(/\s+/);
};

/**
 * Set an element's class name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               One or more space-delimited classes to set.
 */
Jymin.setClass = function (element, className) {
  element.className = className;
};

/**
 * Find out whether an element has a specified class.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to search for.
 * @return {boolean}                True if the class was found.
 */
Jymin.hasClass = function (element, className) {
  var classes = Jymin.getClasses(element);
  return classes.indexOf(className) > -1;
};

/**
 * Add a class to a given element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}               A class to add if it's not already there.
 */
Jymin.addClass = function (element, className) {
  if (!Jymin.hasClass(element, className)) {
    element.className += ' ' + className;
  }
};

/**
 * Remove a class from a given element, assuming no duplication.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               A class to remove.
 */
Jymin.removeClass = function (element, className) {
  var classes = Jymin.getClasses(element);
  var index = classes.indexOf(className);
  if (index > -1) {
    classes.splice(index, 1);
  }
  classes.join(' ');
  Jymin.setClass(element, classes);
};

/**
 * Turn a class on or off on a given element.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to add or remove.
 * @param  {boolean}     flipOn     Whether to add, rather than removing.
 */
Jymin.flipClass = function (element, className, flipOn) {
  var method = flipOn ? Jymin.addClass : Jymin.removeClass;
  method(element, className);
};

/**
 * Turn a class on if it's off, or off if it's on.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to toggle.
 * @return {boolean}                True if the class was turned on.
 */
Jymin.toggleClass = function (element, className) {
  var flipOn = !Jymin.hasClass(element, className);
  Jymin.flipClass(element, className, flipOn);
  return flipOn;
};

/**
 * Find elements matching a selector, and return or run a function on them.
 *
 * Selectors are not fully querySelector compatible.
 * Selectors only support commas, spaces, IDs, tags & classes.
 *
 * @param  {HTMLElement}    parentElement  An optional element under which to find elements.
 * @param  {String}         selector       A simple selector for finding elements.
 * @param  {Function}       fn             An optional function to run on matching elements.
 * @return {HTMLCollection}                The matching elements (if any).
 */
Jymin.all = function (parentElement, selector, fn) {
  if (!selector || Jymin.isFunction(selector)) {
    fn = selector;
    selector = parentElement;
    parentElement = document;
  }
  var elements;


  elements = parentElement.querySelectorAll(selector);

  if (fn) {
    Jymin.forEach(elements, fn);
  }
  return elements;
};

/**
 * Find an element matching a selector, optionally run a function on it, and return it.
 *
 * @param  {HTMLElement} parentElement  An optional element under which to find an element.
 * @param  {String}      selector       A simple selector for finding an element.
 * @param  {Function}    fn             An optional function to run on a matching element.
 * @return {HTMLElement}                The matching element (if any).
 */
Jymin.one = function (parentElement, selector, fn) {
  if (!selector || Jymin.isFunction(selector)) {
    fn = selector;
    selector = parentElement;
    parentElement = document;
  }
  var element;


  element = parentElement.querySelector(selector);

  if (element && fn) {
    fn(element);
  }
  return element;
};


/**
 * Push new HTML into one or more selected elements.
 *
 * @param  {String} html     A string of HTML.
 * @param  {String} selector An optional selector (default: "body").
 */
Jymin.pushHtml = function (html, selector) {

  // Grab the new page title if there is one.
  var title = Jymin.getTagContents(html, 'title')[0];

  // If there's no target, we're replacing the body contents.
  if (!selector) {
    selector = 'body';
    html = Jymin.getTagContents(html, selector)[0];
  }

  // TODO: Implement a DOM diff.
  Jymin.all(selector || 'body', function (element) {

    // Set the HTML of an element.
    Jymin.setHtml(element, html);

    // If there's a title, set it.
    if (title) {
      document.title = title;
      Jymin.scrollTop(0);
    }
    Jymin.ready(element);
  });

  // Execute any scripts that are found.
  // TODO: Skip over JSX, etc.
  Jymin.getTagContents(html, 'script', Jymin.execute);
};
/**
 * Create an event emitter object, lazily loading its prototype.
 */
Jymin.Emitter = function () {
  this._events = {};
  if (!this._on) {
    Jymin.decorateObject(Jymin.Emitter.prototype, Jymin.EmitterPrototype);
  }
};

/**
 * Expose Emitter methods which can be applied lazily.
 */
Jymin.EmitterPrototype = {

  _on: function (event, fn) {
    var self = this;
    var events = self._events;
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
    var listeners = self._events[event] || [];
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

  _removeAllListeners: function (event) {
    var self = this;
    var events = self._events;
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
Jymin.FOCUS = 'focus';
Jymin.BLUR = 'blur';
Jymin.CLICK = 'click';
Jymin.MOUSEDOWN = 'mousedown';
Jymin.MOUSEUP = 'mouseup';
Jymin.MOUSEOVER = 'mouseover';
Jymin.MOUSEOUT = 'mouseout';
Jymin.KEYDOWN = 'keydown';
Jymin.KEYUP = 'keyup';
Jymin.KEYPRESS = 'keypress';

Jymin.CANCEL_BUBBLE = 'cancelBubble';
Jymin.PREVENT_DEFAULT = 'preventDefault';
Jymin.STOP_PROPAGATION = 'stopPropagation';
Jymin.ADD_EVENT_LISTENER = 'addEventListener';
Jymin.ATTACH_EVENT = 'attachEvent';
Jymin.ON = 'on';

/**
 * Bind an event listener for one or more events on an element.
 *
 * @param  {HTMLElement}  element  An element to bind an event listener to.
 * @param  {string|Array} events   An array or comma-delimited string of event names.
 * @param  {function}     listener  A function to run when the event occurs or is triggered: `listener(element, event, target)`.
 */
Jymin.bind = function (element, events, listener) {
  Jymin.forEach(events, function (event) {

    // Invoke the event listener with the event information and the target element.
    var fn = function (event) {
      // Fall back to window.event for IE.
      event = event || window.event;
      // Fall back to srcElement for IE.
      var target = event.target || event.srcElement;
      // Make sure this isn't a text node in Safari.
      if (target.nodeType == 3) {
        target = Jymin.getParent(target);
      }
      listener(element, event, target);
    };

    // Bind for emitting.
    var events = (element._events = element._events || {});
    var listeners = (events[event] = events[event] || []);
    Jymin.push(listeners, listener);

    // Bind using whatever method we can use.
    var method = Jymin.ADD_EVENT_LISTENER;
    var key;
    if (element[method]) {
      element[method](event, fn, true);
    }
    else {
      method = Jymin.ATTACH_EVENT;
      key = Jymin.ON + event;
      if (element[method]) {
        element[method](key, fn);
      }
    }
  });
};

/**
 * Bind a listener to an element to receive bubbled events from descendents matching a selector.
 *
 * @param  {HTMLElement}  element   The element to bind a listener to.
 * @param  {String}       selector  The selector for descendents.
 * @param  {String|Array} events    A list of events to listen for.
 * @param  {function} listener      A function to call on an element, event and descendent.
 */
Jymin.on = function (element, selector, events, listener) {
  if (Jymin.isFunction(events)) {
    listener = events;
    events = selector;
    selector = element;
    element = document;
  }
  Jymin.bind(element, events, function (element, event, target) {
    var trail = Jymin.getTrail(target, selector);
    Jymin.forEach(trail, function (element) {
      listener(element, event, target);
      return !event[Jymin.CANCEL_BUBBLE];
    });
  });
};

/**
 * Trigger an event on an element, and bubble it up to parent elements.
 *
 * @param  {HTMLElement}  element  Element to trigger an event on.
 * @param  {Event|string} event    Event or event type to trigger.
 * @param  {HTMLElement}  target   Fake target.
 */
Jymin.trigger = function (element, event, target) {
  if (element) {
    var type = event.type;
    event = type ? event : {type: (type = event)};
    event._triggered = true;
    target = target || element;

    var listeners = (element._events || 0)[type];
    Jymin.forEach(listeners, function (fn) {
      fn(element, event, target);
    });
    if (!event[Jymin.CANCEL_BUBBLE]) {
      Jymin.trigger(element.parentNode, event, target);
    }
  }
};

/**
 * Stop an event from bubbling up the DOM.
 *
 * @param  {Event} event  Event to stop.
 */
Jymin.stopPropagation = function (event) {
  (event || 0)[Jymin.CANCEL_BUBBLE] = true;
  Jymin.apply(event, Jymin.STOP_PROPAGATION);
};

/**
 * Prevent the default action for this event.
 *
 * @param  {Event} event  Event to prevent from doing its default action.
 */
Jymin.preventDefault = function (event) {
  Jymin.apply(event, Jymin.PREVENT_DEFAULT);
};

/**
 * Focus on a specified element.
 *
 * @param  {HTMLElement} element  The element to focus on.
 */
Jymin.focusElement = function (element) {
  Jymin.apply(element, Jymin.FOCUS);
};
/**
 * Get the value of a form element.
 *
 * @param  {HTMLElement}  input  A form element.
 * @return {String|Array}        The value of the form element (or array of elements).
 */
Jymin.getValue = function (input) {
  input = Jymin.getElement(input);
  if (input) {
    var type = input.type[0];
    var value = input.value;
    var checked = input.checked;
    var options = input.options;
    if (type == 'c' || type == 'r') {
      value = checked ? value : null;
    }
    else if (input.multiple) {
      value = [];
      Jymin.forEach(options, function (option) {
        if (option.selected) {
          Jymin.push(value, option.value);
        }
      });
    }
    else if (options) {
      value = Jymin.getValue(options[input.selectedIndex]);
    }
    return value;
  }
};

/**
 * Set the value of a form element.
 *
 * @param  {HTMLElement}  input  A form element.
 * @return {String|Array}        A value or values to set on the form element.
 */
Jymin.setValue = function (input, value) {
  input = Jymin.getElement(input);
  if (input) {
    var type = input.type[0];
    var options = input.options;
    if (type == 'c' || type == 'r') {
      input.checked = value ? true : false;
    }
    else if (options) {
      var selected = {};
      if (input.multiple) {
        Jymin.forEach(value, function (optionValue) {
          selected[optionValue] = true;
        });
      }
      else {
        selected[value] = true;
      }
      value = Jymin.isArray(value) ? value : [value];
      Jymin.forEach(options, function (option) {
        option.selected = !!selected[option.value];
      });
    }
    else {
      input.value = value;
    }
  }
};
/**
 * Apply arguments to an object method.
 *
 * @param  {Object}          object      An object with methods.
 * @param  {string}          methodName  A method name, which may exist on the object.
 * @param  {Arguments|Array} args        An arguments object or array to apply to the method.
 * @return {Object}                      The result returned by the object method.
 */
Jymin.apply = function (object, methodName, args) {
  return ((object || 0)[methodName] || Jymin.doNothing).apply(object, args);
};
/**
 * Return a history object.
 */
Jymin.getHistory = function () {
  var history = window.history || {};
  Jymin.forEach(['push', 'replace'], function (key) {
    var fn = history[key + 'State'];
    history[key] = function (href) {
      if (fn) {
        fn.apply(history, [null, null, href]);
      } else {
        // TODO: Create a backward compatible history push.
      }
    };
  });
  return history;
};

/**
 * Push an item into the history.
 */
Jymin.historyPush = function (href) {
  Jymin.getHistory().push(href);
};

/**
 * Replace the current item in the history.
 */
Jymin.historyReplace = function (href) {
  Jymin.getHistory().replace(href);
};

/**
 * Go back.
 */
Jymin.historyPop = function () {
  Jymin.getHistory().back();
};

/**
 * Listen for a history change.
 */
Jymin.onHistoryPop = function (callback) {
  Jymin.bind(window, 'popstate', callback);
};
/**
 * The values in this file can be overridden externally.
 * The default locale is US. Sorry, World.
 */

/**
 * Month names in English.
 * @type {Array}
 */
Jymin.i18nMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * The word "at" in English (for separating date & time).
 * @type {String}
 */
Jymin.i18nAt = 'at';

/**
 * Whether to show dates in DD/MM/YYYY format.
 * @type {Booly}
 */
Jymin.i18nDayMonthYear = 0;

/**
 * Whether to show times in 24-hour format.
 * @type {Booly}
 */
Jymin.i18n24Hour = 0;

/**
 * Why oh why did I have to learn different units than the rest of the world?
 * @type {String}
 */
Jymin.i18nTemperature = 'F';
/**
 * Create a circular-safe JSON string.
 */
Jymin.safeStringify = function (data, stack) {
  if (Jymin.isString(data)) {
    data = '"' + data.replace(/\n\r"/g, function (c) {
      return c == '\n' ? '\\n' : c == '\r' ? '\\r' : '\\"';
    }) + '"';
  }
  else if (Jymin.isFunction(data) || Jymin.isUndefined(data) || (data === null)) {
    return null;
  }
  else if (data && Jymin.isObject(data)) {
    stack = stack || [];
    var isCircular;
    Jymin.forEach(stack, function (item) {
      if (item == data) {
        isCircular = 1;
      }
    });
    if (isCircular) {
      return null;
    }
    Jymin.push(stack, data);
    var parts = [];
    var before, after;
    if (Jymin.isArray(data)) {
      before = '[';
      after = ']';
      Jymin.forEach(data, function (value) {
        Jymin.push(parts, Jymin.stringify(value, stack));
      });
    }
    else {
      before = '{';
      after = '}';
      Jymin.forIn(data, function (key, value) {
        Jymin.push(parts, Jymin.stringify(key) + ':' + Jymin.stringify(value, stack));
      });
    }
    Jymin.pop(stack);
    data = before + parts.join(',') + after;
  }
  else {
    data = '' + data;
  }
  return data;
};

/**
 * Create a JSON string.
 */
Jymin.stringify = function (data) {
  var json;


  json = JSON.stringify(data);

};

/**
 * Parse JavaScript and return a value.
 */
Jymin.parse = function (value, alternative) {
  try {
    var evil = window.eval; // jshint ignore:line
    evil('eval.J=' + value);
    value = evil.J;
  }
  catch (e) {
    //+env:debug
    Jymin.error('[Jymin] Could not parse JS: ' + value);
    //-env:debug
    value = alternative;
  }
  return value;
};

/**
 * Execute JavaScript.
 */
Jymin.execute = function (text) {
  Jymin.parse('0;' + text);
};

/**
 * Parse a value and return a boolean no matter what.
 */
Jymin.parseBoolean = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isBoolean(value) ? value : (alternative || false);
};

/**
 * Parse a value and return a number no matter what.
 */
Jymin.parseNumber = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isNumber(value) ? value : (alternative || 0);
};

/**
 * Parse a value and return a string no matter what.
 */
Jymin.parseString = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isString(value) ? value : (alternative || '');
};

/**
 * Parse a value and return an object no matter what.
 */
Jymin.parseObject = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isObject(value) ? value : (alternative || {});
};

/**
 * Parse a value and return a number no matter what.
 */
Jymin.parseArray = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isObject(value) ? value : (alternative || []);
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
 * Scroll the top of the page to a specified Y position.
 *
 * @param  {Integer} top  A specified Y position, in pixels.
 */
Jymin.scrollTop = function (top) {
  document.body.scrollTop = (document.documentElement || 0).scrollTop = top;
};

/**
 * Scroll the top of the page to a specified named anchor.
 *
 * @param  {String} name  The name of an HTML anchor.
 * @return {String}
 */
Jymin.scrollToAnchor = function (name) {
  var offset = 0;
  var element;


  element = Jymin.all('a[name=' + name + ']')[0];

  while (element) {
    offset += element.offsetTop || 0;
    element = element.offsetParent || 0;
  }
  Jymin.scrollTop(offset - (Jymin.body._.offsetTop || 0));
};
/**
 * If the argument is numeric, return a number, otherwise return zero.
 *
 * @param  {Object} number  An object to convert to a number, if necessary.
 * @return {number}         The number, or zero.
 */
Jymin.ensureNumber = function (number) {
  return isNaN(number *= 1) ? 0 : number;
};

/**
 * Left-pad a number with zeros if it's shorter than the desired length.
 *
 * @param  {number} number  A number to pad.
 * @param  {number} length  A length to pad to.
 * @return {String}         The zero-padded number.
 */
Jymin.zeroFill = function (number, length) {
  number = '' + number;
  // Repurpose the lenth variable to count how much padding we need.
  length = Math.max(length - Jymin.getLength(number), 0);
  return (new Array(length + 1)).join('0') + number;
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
 * Execute a function when the page loads or new content is added.
 *
 * @param  {Function}  fn  A function which will receive a ready element.
 */
Jymin.onReady = function (fn) {

  // If the document is ready, run the function now.
  if (document._isReady) {
    fn(document);
  }

  // Otherwise, bind the ready handler.
  else {
    Jymin.bindReady(document, function () {
      Jymin.trigger(document, 'ready');
    });
  }

  // Bind to the document's Jymin-triggered ready event.
  Jymin.bind(document, 'ready', fn);
};

/**
 * Bind to the appropriate ready event for an element.
 * This works for the document as well as for scripts.
 *
 * @param  {HTMLElement} element  An element to bind to.
 * @param  {Function}    fn       A function to run when the element is ready.
 */
Jymin.bindReady = function (element, fn) {

  // Create a listener that replaces itself so it will only run once.
  var onLoad = function () {
    if (Jymin.isReady(element)) {
      onLoad = Jymin.doNothing;
      window.onload = element.onload = element.onreadystatechange = null;
      fn(element);
    }
  };

  // Bind to the document in MSIE8, or scripts in other browsers.
  Jymin.bind(element, 'readystatechange', onLoad);
  if (element == document) {
    // Bind to the document in newer browsers.
    Jymin.bind(element, 'DOMContentLoaded', onLoad);
  }
  // Fall back.
  Jymin.bind(element == document ? window : element, 'load', onLoad);
};

/**
 * Declare an object to be ready, and run events that have been bound to it.
 *
 * @param  {Any} thing  An HTMLElement or other object.
 */
Jymin.ready = function (thing) {
  thing._isReady = 1;
  Jymin.trigger(thing, 'ready');
};

/**
 * Check if a document, iframe, script or AJAX response is ready.
 * @param  {Object}  object [description]
 * @return {Boolean}        [description]
 */
Jymin.isReady = function (object) {
  // AJAX requests have readyState 4 when loaded.
  // All documents will reach readyState=="complete".
  // In IE, scripts can reach readyState=="loaded" or readyState=="complete".
  // In non-IE browsers, we can bind to script.onload instead of checking script.readyState.
  return /(4|complete|scriptloaded)$/.test('' + object.tagName + object.readyState);
};

/**
 * Insert an external JavaScript file.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {HTMLElement} element  An element.
 * @param  {String}      src      A source URL of a script to insert.
 * @param  {function}    fn       An optional function to run when the script loads.
 */
Jymin.insertScript = function (src, fn) {
  var head = Jymin.all('head')[0];
  var script = Jymin.addElement(head, 'script');
  if (fn) {
    Jymin.bindReady(script, fn);
  }
  script.src = src;
};
/**
 * Get the contents of a specified type of tag within a string of HTML.
 *
 * @param  {String}   html    [description]
 * @param  {String}   tagName [description]
 * @param  {Function} fn      [description]
 * @return {Array}           [description]
 */
Jymin.getTagContents = function (html, tagName, fn) {
  var pattern = new RegExp('<' + tagName + '.*?>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  var contents = [];
  html.replace(pattern, function (match, content) {
    contents.push(content);
    if (fn) {
      fn(content);
    }
  });
  return contents;
};
/**
 * Get the local storage object.
 *
 * @return {Object}  The local storage object.
 */
Jymin.getStorage = function () {
  return window.localStorage;
};

/**
 * Fetch an item from local storage.
 *
 * @param  {String} key  A key to fetch an object by
 * @return {Any}         The object that was fetched and deserialized
 */
Jymin.fetch = function (key) {
  var storage = Jymin.getStorage();
  return storage ? Jymin.parse(storage.getItem(key)) : 0;
};

/**
 * Store an item in local storage.
 *
 * @param  {String} key    A key to store and fetch an object by
 * @param  {Any}    value  A value to be stringified and stored
 */
Jymin.store = function (key, value) {
  var storage = Jymin.getStorage();
  if (storage) {
    storage.setItem(key, Jymin.stringify(value));
  }
};
/**
 * Ensure a value is a string.
 */
Jymin.ensureString = function (value) {
  return Jymin.isString(value) ? value : '' + value;
};

/**
 * Return true if the string contains the given substring.
 */
Jymin.contains = function (string, substring) {
  return Jymin.ensureString(string).indexOf(substring) > -1;
};

/**
 * Return true if the string starts with the given substring.
 */
Jymin.startsWith = function (string, substring) {
  return Jymin.ensureString(string).indexOf(substring) == 0; // jshint ignore:line
};

/**
 * Trim the whitespace from a string.
 */
Jymin.trim = function (string) {
  return Jymin.ensureString(string).replace(/^\s+|\s+$/g, '');
};

/**
 * Split a string by commas.
 */
Jymin.splitByCommas = function (string) {
  return Jymin.ensureString(string).split(',');
};

/**
 * Split a string by spaces.
 */
Jymin.splitBySpaces = function (string) {
  return Jymin.ensureString(string).split(' ');
};

/**
 * Return a string, with asterisks replaced by values from a replacements array.
 */
Jymin.decorateString = function (string, replacements) {
  string = Jymin.ensureString(string);
  Jymin.forEach(replacements, function(replacement) {
    string = string.replace('*', replacement);
  });
  return string;
};

/**
 * Perform a RegExp Jymin.match, and call a callback on the result;
  */
Jymin.match = function (string, pattern, callback) {
  var result = string.match(pattern);
  if (result) {
    callback.apply(string, result);
  }
};

/**
 * Reduce a string to its alphabetic characters.
 */
Jymin.extractLetters = function (string) {
  return Jymin.ensureString(string).replace(/[^a-z]/ig, '');
};

/**
 * Reduce a string to its numeric characters.
 */
Jymin.extractNumbers = function (string) {
  return Jymin.ensureString(string).replace(/[^0-9]/g, '');
};

/**
 * Returns a lowercase string.
 */
Jymin.lower = function (object) {
  return Jymin.ensureString(object).toLowerCase();
};

/**
 * Returns an uppercase string.
 */
Jymin.upper = function (object) {
  return Jymin.ensureString(object).toUpperCase();
};

/**
 * Return an escaped value for URLs.
 */
Jymin.escape = function (value) {
  return '' + encodeURIComponent('' + value);
};

/**
 * Return an unescaped value from an escaped URL.
 */
Jymin.unescape = function (value) {
  return '' + decodeURIComponent('' + value);
};

/**
 * Returns a query string generated by serializing an object and joined using a delimiter (defaults to '&')
 */
Jymin.buildQueryString = function (object) {
  var queryParams = [];
  Jymin.forIn(object, function(key, value) {
    queryParams.push(Jymin.escape(key) + '=' + Jymin.escape(value));
  });
  return queryParams.join('&');
};

/**
 * Return the browser version if the browser name matches or zero if it doesn't.
 */
Jymin.getBrowserVersionOrZero = function (browserName) {
  var match = new RegExp(browserName + '[ /](\\d+(\\.\\d+)?)', 'i').exec(navigator.userAgent);
  return match ? +Jymin.match[1] : 0;
};
/**
 * Set or reset a timeout or interval, and save it for possible cancellation.
 * The timer can either be added to the setTimer method itself, or it can
 * be added to an object provided (such as an HTMLElement).
 *
 * @param {Object|String} objectOrString  An object to bind a timer to, or a name to call it.
 * @param {Function}      fn              A function to run if the timer is reached.
 * @param {Integer}       delay           An optional delay in milliseconds.
 */
Jymin.setTimer = function (objectOrString, fn, delay, isInterval) {
  var useString = Jymin.isString(objectOrString);
  var object = useString ? Jymin.setTimer : objectOrString;
  var key = useString ? objectOrString : '_timeout';
  clearTimeout(object[key]);
  if (fn) {
    if (Jymin.isUndefined(delay)) {
      delay = 9;
    }
    object[key] = (isInterval ? setInterval : setTimeout)(fn, delay);
  }
};

/**
 * Remove a timer from an element or from the Jymin.setTimer method.
 *
 * @param {Object|String} objectOrString  An object or a timer name.
 */
Jymin.clearTimer = function (objectOrString) {
  Jymin.setTimer(objectOrString);
};
/**
 * Check whether a value is of a given primitive type.
 *
 * @param  {Any}     value  A value to check.
 * @param  {Any}     type   The primitive type.
 * @return {boolean}        True if the value is of the given type.
 */
Jymin.isType = function (value, type) {
  return typeof value == type;
};

/**
 * Check whether a value is undefined.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is undefined.
 */
Jymin.isUndefined = function (value) {
  return typeof value == 'undefined';
};

/**
 * Check whether a value is a boolean.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a boolean.
 */
Jymin.isBoolean = function (value) {
  return typeof value == 'boolean';
};

/**
 * Check whether a value is a number.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a number.
 */
Jymin.isNumber = function (value) {
  return typeof value == 'number';
};

/**
 * Check whether a value is a string.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a string.
 */
Jymin.isString = function (value) {
  return typeof value == 'string';
};

/**
 * Check whether a value is a function.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a function.
 */
Jymin.isFunction = function (value) {
  return typeof value == 'function';
};

/**
 * Check whether a value is an object.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an object.
 */
Jymin.isObject = function (value) {
  return typeof value == 'object';
};

/**
 * Check whether a value is null.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is null.
 */
Jymin.isNull = function (value) {
  return value === null;
};

/**
 * Check whether a value is an instance of a given type.
 *
 * @param  {Any}      value        A value to check.
 * @param  {Function} Constructor  A constructor for a type of object.
 * @return {boolean}               True if the value is an instance of a given type.
 */
Jymin.isInstance = function (value, Constructor) {
  return value instanceof Constructor;
};

/**
 * Check whether a value is an array.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an array.
 */
Jymin.isArray = function (value) {
  return Jymin.isInstance(value, Array);
};

/**
 * Check whether a value is a date.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a date.
 */
Jymin.isDate = function (value) {
  return Jymin.isInstance(value, Date);
};

/**
 * Check whether a value is an error.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an error.
 */
Jymin.isError = function (value) {
  return Jymin.isInstance(value, Error);
};

/**
 * Check whether a value is a regular expression.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a regular expression.
 */
Jymin.isRegExp = function (value) {
  return Jymin.isInstance(value, RegExp);
};
/**
 * Get the current location host.
 */
Jymin.getHost = function () {
  return location.host;
};

/**
 * Get the base of the current URL.
 */
Jymin.getBaseUrl = function () {
  return location.protocol + '//' + Jymin.getHost();
};

/**
 * Get the query parameters from a URL.
 */
Jymin.getQueryParams = function (url) {
  url = url || location.href;
  var query = url.substr(url.indexOf('?') + 1).split('#')[0];
  var pairs = query.split('&');
  query = {};
  Jymin.forEach(pairs, function (pair) {
    var eqPos = pair.indexOf('=');
    var name = pair.substr(0, eqPos);
    var value = pair.substr(eqPos + 1);
    query[name] = value;
  });
  return query;
};

/**
 * Get the query parameters from the hash of a URL.
 */
Jymin.getHashParams = function (hash) {
  hash = (hash || location.hash).replace(/^#/, '');
  return hash ? Jymin.getQueryParams(hash) : {};
};
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
 * Name of the XMLHttpRequest object.
 * @type {String}
 */
Jymin.XHR = 'XMLHttpRequest';

/**
 * Get an XMLHttpRequest object (or ActiveX object in old IE).
 *
 * @return {XMLHttpRequest}   The request object.
 */
Jymin.getXhr = function () {
  var xhr;
  //+browser:old
  xhr = window.XMLHttpRequest ? new XMLHttpRequest() :
    window.ActiveXObject ? new ActiveXObject('Microsoft.XMLHTTP') : // jshint ignore:line
    false;
  //-browser:old
  //+browser:ok
  xhr = new XMLHttpRequest();
  //-browser:ok
  return xhr;
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
    Jymin.bindReady(request, function () {

      //+env:debug
      Jymin.log('[Jymin] Received response from "' + url + '". (' + Jymin.getResponse._waiting + ' in progress).');
      --Jymin.getResponse._waiting;
      //-env:debug

      var status = request.status;
      var isSuccess = (status == 200);
      var fn = isSuccess ?
        onSuccess || Jymin.responseSuccessFn :
        onFailure || Jymin.responseFailureFn;
      var data = Jymin.parse(request.responseText) || {};
      fn(data, request, status);
    });
    request.open(body ? 'POST' : 'GET', url, true);
    if (body) {
      request.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    }

    //+env:debug

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
    array = Jymin.isString(array) ? Jymin.splitByCommas(array) : array;
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
    array = Jymin.isString(array) ? Jymin.splitByCommas(array) : array;
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
 * Get all cookies from the document, and return a map.
 *
 * @return {Object}  The map of cookie names and values.
 */
Jymin.getAllCookies = function () {
  var obj = {};
  var documentCookie = Jymin.trim(document.cookie);
  if (documentCookie) {
    var cookies = documentCookie.split(/\s*;\s*/);
    Jymin.forEach(cookies, function (cookie) {
      var pair = cookie.split(/\s*=\s*/);
      obj[Jymin.unescape(pair[0])] = Jymin.unescape(pair[1]);
    });
  }
  return obj;
};

/**
 * Get a cookie by its name.
 *
 * @param  {String} name  A cookie name.
 * @return {String}       The cookie value.
 */
Jymin.getCookie = function (name) {
  return Jymin.getAllCookies()[name];
};

/**
 * Set or overwrite a cookie value.
 *
 * @param {String} name     A cookie name, whose value is to be set.
 * @param {Object} value    A value to be set as a string.
 * @param {Object} options  Optional cookie options, including "maxage", "expires", "path", "domain" and "secure".
 */
Jymin.setCookie = function (name, value, options) {
  options = options || {};
  var str = Jymin.escape(name) + '=' + Jymin.unescape(value);
  if (null === value) {
    options.maxage = -1;
  }
  if (options.maxage) {
    options.expires = new Date(+new Date() + options.maxage);
  }
  document.cookie = str +
    (options.path ? ';path=' + options.path : '') +
    (options.domain ? ';domain=' + options.domain : '') +
    (options.expires ? ';expires=' + options.expires.toUTCString() : '') +
    (options.secure ? ';secure' : '');
};

/**
 * Delete a cookie by name.
 *
 * @param {String} name  A cookie name, whose value is to be deleted.
 */
Jymin.deleteCookie = function (name) {
  Jymin.setCookie(name, null);
};
/**
 * Calculate an MD5 hash for a string (useful for things like Gravatars).
 *
 * @param  {String} s  A string to hash.
 * @return {String}    The MD5 hash for the given string.
 */
Jymin.md5 = function (str) {

  // Encode as UTF-8.
  str = decodeURIComponent(encodeURIComponent(str));

  // Build an array of little-endian words.
  var arr = new Array(str.length >> 2);
  for (var idx = 0, len = arr.length; idx < len; idx += 1) {
    arr[idx] = 0;
  }
  for (idx = 0, len = str.length * 8; idx < len; idx += 8) {
    arr[idx >> 5] |= (str.charCodeAt(idx / 8) & 0xFF) << (idx % 32);
  }

  // Calculate the MD5 of an array of little-endian words.
  arr[len >> 5] |= 0x80 << (len % 32);
  arr[(((len + 64) >>> 9) << 4) + 14] = len;

  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;

  len = arr.length;
  idx = 0;
  while (idx < len) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    var e = arr[idx++];
    var f = arr[idx++];
    var g = arr[idx++];
    var h = arr[idx++];
    var i = arr[idx++];
    var j = arr[idx++];
    var k = arr[idx++];
    var l = arr[idx++];
    var m = arr[idx++];
    var n = arr[idx++];
    var o = arr[idx++];
    var p = arr[idx++];
    var q = arr[idx++];
    var r = arr[idx++];
    var s = arr[idx++];
    var t = arr[idx++];

    a = ff(a, b, c, d, e, 7, -680876936);
    d = ff(d, a, b, c, f, 12, -389564586);
    c = ff(c, d, a, b, g, 17, 606105819);
    b = ff(b, c, d, a, h, 22, -1044525330);
    a = ff(a, b, c, d, i, 7, -176418897);
    d = ff(d, a, b, c, j, 12, 1200080426);
    c = ff(c, d, a, b, k, 17, -1473231341);
    b = ff(b, c, d, a, l, 22, -45705983);
    a = ff(a, b, c, d, m, 7, 1770035416);
    d = ff(d, a, b, c, n, 12, -1958414417);
    c = ff(c, d, a, b, o, 17, -42063);
    b = ff(b, c, d, a, p, 22, -1990404162);
    a = ff(a, b, c, d, q, 7, 1804603682);
    d = ff(d, a, b, c, r, 12, -40341101);
    c = ff(c, d, a, b, s, 17, -1502002290);
    b = ff(b, c, d, a, t, 22, 1236535329);

    a = gg(a, b, c, d, f, 5, -165796510);
    d = gg(d, a, b, c, k, 9, -1069501632);
    c = gg(c, d, a, b, p, 14, 643717713);
    b = gg(b, c, d, a, e, 20, -373897302);
    a = gg(a, b, c, d, j, 5, -701558691);
    d = gg(d, a, b, c, o, 9, 38016083);
    c = gg(c, d, a, b, t, 14, -660478335);
    b = gg(b, c, d, a, i, 20, -405537848);
    a = gg(a, b, c, d, n, 5, 568446438);
    d = gg(d, a, b, c, s, 9, -1019803690);
    c = gg(c, d, a, b, h, 14, -187363961);
    b = gg(b, c, d, a, m, 20, 1163531501);
    a = gg(a, b, c, d, r, 5, -1444681467);
    d = gg(d, a, b, c, g, 9, -51403784);
    c = gg(c, d, a, b, l, 14, 1735328473);
    b = gg(b, c, d, a, q, 20, -1926607734);

    a = hh(a, b, c, d, j, 4, -378558);
    d = hh(d, a, b, c, m, 11, -2022574463);
    c = hh(c, d, a, b, p, 16, 1839030562);
    b = hh(b, c, d, a, s, 23, -35309556);
    a = hh(a, b, c, d, f, 4, -1530992060);
    d = hh(d, a, b, c, i, 11, 1272893353);
    c = hh(c, d, a, b, l, 16, -155497632);
    b = hh(b, c, d, a, o, 23, -1094730640);
    a = hh(a, b, c, d, r, 4, 681279174);
    d = hh(d, a, b, c, e, 11, -358537222);
    c = hh(c, d, a, b, h, 16, -722521979);
    b = hh(b, c, d, a, k, 23, 76029189);
    a = hh(a, b, c, d, n, 4, -640364487);
    d = hh(d, a, b, c, q, 11, -421815835);
    c = hh(c, d, a, b, t, 16, 530742520);
    b = hh(b, c, d, a, g, 23, -995338651);

    a = ii(a, b, c, d, e, 6, -198630844);
    d = ii(d, a, b, c, l, 10, 1126891415);
    c = ii(c, d, a, b, s, 15, -1416354905);
    b = ii(b, c, d, a, j, 21, -57434055);
    a = ii(a, b, c, d, q, 6, 1700485571);
    d = ii(d, a, b, c, h, 10, -1894986606);
    c = ii(c, d, a, b, o, 15, -1051523);
    b = ii(b, c, d, a, f, 21, -2054922799);
    a = ii(a, b, c, d, m, 6, 1873313359);
    d = ii(d, a, b, c, t, 10, -30611744);
    c = ii(c, d, a, b, k, 15, -1560198380);
    b = ii(b, c, d, a, r, 21, 1309151649);
    a = ii(a, b, c, d, i, 6, -145523070);
    d = ii(d, a, b, c, p, 10, -1120210379);
    c = ii(c, d, a, b, g, 15, 718787259);
    b = ii(b, c, d, a, n, 21, -343485551);

    a = add(a, olda);
    b = add(b, oldb);
    c = add(c, oldc);
    d = add(d, oldd);
  }
  arr = [a, b, c, d];

  // Build a string.
  var hex = '0123456789abcdef';
  str = '';
  for (idx = 0, len = arr.length * 32; idx < len; idx += 8) {
    var code = (arr[idx >> 5] >>> (idx % 32)) & 0xFF;
    str += hex.charAt((code >>> 4) & 0x0F) + hex.charAt(code & 0x0F);
  }

  return str;

  /**
   * Add 32-bit integers, using 16-bit operations to mitigate JS interpreter bugs.
   */
  function add(a, b) {
    var lsw = (a & 0xFFFF) + (b & 0xFFFF);
    var msw = (a >> 16) + (b >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  function cmn(q, a, b, x, s, t) {
    a = add(add(a, q), add(x, t));
    return add((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

};
/**
 * Get Unix epoch milliseconds from a date.
 *
 * @param {Date}    date  An optional Date object (default: now).
 * @return {Number}       Epoch milliseconds.
 */
Jymin.getTime = function (date) {
  return date ? date.getTime() : Date.now();
};

/**
 * Get an ISO-standard date string.
 *
 * @param {Date}    date  Date object (default: now).
 * @return {String}       ISO date string.
 */
Jymin.getIsoDate = function (date) {
  date = date || new Date();
  //+browser:ok
  date = date.toISOString();
  //-browser:ok
  //+browser:old
  var utcPattern = /^.*?(\d+) (\w+) (\d+) ([\d:]+).*?$/;
  date = date.toUTCString().replace(utcPattern, function (a, day, m, y, t) {
    m = Jymin.zeroFill(date.getMonth(), 2);
    t += '.' + Jymin.zeroFill(date.getMilliseconds(), 3);
    return y + '-' + m + '-' + day + 'T' + t + 'Z';
  });
  //-browser:old
  return date;
};

/**
 * Take a date and return a formatted date string in long or short format:
 * - Short: "8/26/14 7:42pm"
 * - Long: "August 26, 2014 at 7:42pm"
 *
 * @param  {Object}  date    An optional Date object or constructor argument.
 * @param  {Boolean} isLong  Whether to output the short or long format.
 * @param  {Boolean} isTime  Whether to append the time.
 * @return {String}          The formatted date string.
 */
Jymin.formatDate = function (date, isLong, isTime) {
  if (!Jymin.isDate(date)) {
    date = new Date(+date || date);
  }
  var m = date.getMonth();
  var day = date.getDate();
  var y = date.getFullYear();
  if (isLong) {
    m = Jymin.i18nMonths[m];
  }
  else {
    m++;
    y = ('' + y).substr(2);
  }
  var isAm = 1;
  var hour = +date.getHours();
  var minute = date.getMinutes();
  minute = minute > 9 ? minute : '0' + minute;
  if (!Jymin.i18n24Hour) {
    if (hour > 12) {
      isAm = 0;
      hour -= 12;
    }
    else if (!hour) {
      hour = 12;
    }
  }
  var string;
  if (Jymin.i18nDayMonthYear) {
    string = m;
    m = day;
    day = string;
  }
  if (isLong) {
    string = m + ' ' + day + ', ' + y;
  }
  else {
    string = m + '/' + day + '/' + y;
  }
  if (isTime) {
    if (isLong) {
      string += ' ' + Jymin.i18nAt;
    }
    string += ' ' + hour + ':' + minute;
    if (Jymin.i18n24Hour) {
      string += (isAm ? 'am' : 'pm');
    }
  }
  return string;
};

/**
 * Taka a date object and return a formatted time string.
 *
 * @param  {Object}  date    An optional Date object or constructor argument.
 * @return {[type]}
 */
Jymin.formatTime = function (date) {
  date = Jymin.formatDate(date).replace(/^.* /, '');
};
/**
 * Get an element by its ID (if the argument is an ID).
 * If you pass in an element, it just returns it.
 * This can be used to ensure that you have an element.
 *
 * @param  {HTMLElement}        parentElement  Optional element to call getElementById on (default: document).
 * @param  {string|HTMLElement} idOrElement    ID of an element, or the element itself.
 * @return {HTMLElement}                       The matching element, or undefined.
 */
Jymin.getElement = function (parentElement, idOrElement) {
  if (!Jymin.hasMany(arguments)) {
    idOrElement = parentElement;
    parentElement = document;
  }
  return Jymin.isString(idOrElement) ? parentElement.getElementById(idOrElement) : idOrElement;
};

/**
 * Get the parent of an element, or an ancestor with a specified tag name.
 *
 * @param  {HTMLElement} element   A element whose parent elements are being searched.
 * @param  {String}      selector  An optional selector to search up the tree.
 * @return {HTMLElement}           The parent or matching ancestor.
 */
Jymin.getParent = function (element, selector) {
  return Jymin.getTrail(element, selector)[1];
};

/**
 * Get the trail that leads back to the root, optionally filtered by a selector.
 *
 * @param  {HTMLElement} element   An element to start the trail.
 * @param  {String}      selector  An optional selector to filter the trail.
 * @return {Array}                 The array of elements in the trail.
 */
Jymin.getTrail = function (element, selector) {
  var trail = [element];
  while (element = element.parentNode) { // jshint ignore:line
    Jymin.push(trail, element);
  }
  if (selector) {
    var set = trail;
    trail = [];
    Jymin.all(selector, function (element) {
      if (set.indexOf(element) > -1) {
        Jymin.push(trail, element);
      }
    });
  }
  return trail;
};

/**
 * Get the children of a parent element.
 *
 * @param  {HTMLElement}    element  A parent element who might have children.
 * @return {HTMLCollection}          The collection of children.
 */
Jymin.getChildren = function (element) {
  return element.childNodes;
};

/**
 * Get an element's index with respect to its parent.
 *
 * @param  {HTMLElement} element  An element with a parent, and potentially siblings.
 * @return {Number}               The element's index, or -1 if there's no matching element.
 */
Jymin.getIndex = function (element) {
  var index = -1;
  while (element) {
    ++index;
    element = element.previousSibling;
  }
  return index;
};

/**
 * Get an element's first child.
 *
 * @param  {HTMLElement} element  An element.
 * @return {[type]}               The element's first child.
 */
Jymin.getFirstChild = function (element) {
  return element.firstChild;
};

/**
 * Get an element's previous sibling.
 *
 * @param  {HTMLElement} element  An element.
 * @return {HTMLElement}          The element's previous sibling.
 */
Jymin.getPreviousSibling = function (element) {
  return element.previousSibling;
};

/**
 * Get an element's next sibling.
 *
 * @param  {HTMLElement} element  An element.
 * @return {HTMLElement}          The element's next sibling.
 */
Jymin.getNextSibling = function (element) {
  return element.nextSibling;
};

/**
 * Create a cloneable element with a specified tag name.
 *
 * @param  {String}      tagName  An optional tag name (default: div).
 * @return {HTMLElement}          The newly-created DOM Element with the specified tag name.
 */
Jymin.createTag = function (tagName) {
  tagName = tagName || 'div';
  var isSvg = /^(svg|g|path|circle|line)$/.test(tagName);
  var uri = 'http://www.w3.org/' + (isSvg ? '2000/svg' : '1999/xhtml');
  return document.createElementNS(uri, tagName);
};

/**
 * Create an element, given a specified tag identifier.
 *
 * Identifiers are of the form:
 *   tagName#id.class1.class2?attr1=value1&attr2=value2
 *
 * Each part of the identifier is optional.
 *
 * @param  {HTMLElement|String} elementOrString  An element or a string used to create an element (default: div).
 * @param  {String}             innerHtml        An optional string of HTML to populate the element.
 * @return {HTMLElement}                         The existing or created element.
 */
Jymin.createElement = function (elementOrString, innerHtml) {
  var element = elementOrString;
  if (Jymin.isString(elementOrString)) {
    var tagAndAttributes = elementOrString.split('?');
    var tagAndClass = tagAndAttributes[0].split('.');
    var className = tagAndClass.slice(1).join(' ');
    var tagAndId = tagAndClass[0].split('#');
    var tagName = tagAndId[0];
    var id = tagAndId[1];
    var attributes = tagAndAttributes[1];
    var cachedElement = Jymin.createTag[tagName] || (Jymin.createTag[tagName] = Jymin.createTag(tagName));
    element = cachedElement.cloneNode(true);
    if (id) {
      element.id = id;
    }
    if (className) {
      element.className = className;
    }
    // TODO: Do something less janky than using query string syntax (Maybe like Ltl?).
    if (attributes) {
      attributes = attributes.split('&');
      Jymin.forEach(attributes, function (attribute) {
        var keyAndValue = attribute.split('=');
        var key = Jymin.unescape(keyAndValue[0]);
        var value = Jymin.unescape(keyAndValue[1]);
        element[key] = value;
        element.setAttribute(key, value);
      });
    }
    if (innerHtml) {
      Jymin.setHtml(element, innerHtml);
    }
  }
  return element;
};

/**
 * Add an element to a parent element, creating it first if necessary.
 *
 * @param  {HTMLElement}        parentElement    An optional parent element (default: document).
 * @param  {HTMLElement|String} elementOrString  An element or a string used to create an element (default: div).
 * @param  {String}             innerHtml        An optional string of HTML to populate the element.
 * @return {HTMLElement}                         The element that was added.
 */
Jymin.addElement = function (parentElement, elementOrString, innerHtml) {
  if (Jymin.isString(parentElement)) {
    elementOrString = parentElement;
    parentElement = document;
  }
  var element = Jymin.createElement(elementOrString, innerHtml);
  parentElement.appendChild(element);
  return element;
};

/**
 * Insert a child element under a parent element, optionally before another element.
 *
 * @param  {HTMLElement}         parentElement    An optional parent element (default: document).
 * @param  {HTMLElement|String}  elementOrString  An element or a string used to create an element (default: div).
 * @param  {HTMLElement}         beforeSibling    An optional child to insert the element before.
 * @return {HTMLElement}                          The element that was inserted.
 */
Jymin.insertElement = function (parentElement, elementOrString, beforeSibling) {
  if (Jymin.isString(parentElement)) {
    beforeSibling = elementOrString;
    elementOrString = parentElement;
    parentElement = document;
  }
  var element = Jymin.createElement(elementOrString);
  if (parentElement) {
    // If the beforeSibling value is a number, get the (future) sibling at that index.
    if (Jymin.isNumber(beforeSibling)) {
      beforeSibling = Jymin.getChildren(parentElement)[beforeSibling];
    }
    // Insert the element, optionally before an existing sibling.
    parentElement.insertBefore(element, beforeSibling || Jymin.getFirstChild(parentElement) || null);
  }
  return element;
};

/**
 * Wrap an element with another element.
 *
 * @param  {HTMLElement}        innerElement  An element to wrap with another element.
 * @param  {HTMLElement|String} outerElement  An element or a string used to create an element (default: div).
 * @return {HTMLElement}                      The element that was created as a wrapper.
 */
Jymin.wrapElement = function (innerElement, outerElement) {
  var parentElement = Jymin.getParent(innerElement);
  outerElement = Jymin.insertElement(parentElement, outerElement, innerElement);
  Jymin.insertElement(outerElement, innerElement);
  return outerElement;
};

/**
 * Remove an element from its parent.
 *
 * @param  {HTMLElement} element  An element to remove.
 */
Jymin.removeElement = function (element) {
  if (element) {
    // Remove the element from its parent, provided that it has a parent.
    var parentElement = Jymin.getParent(element);
    if (parentElement) {
      parentElement.removeChild(element);
    }
  }
};

/**
 * Remove children from an element.
 *
 * @param  {HTMLElement} element  An element whose children should all be removed.
 */
Jymin.clearElement = function (element) {
  Jymin.setHtml(element, '');
};

/**
 * Get an element's inner HTML.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's HTML.
 */
Jymin.getHtml = function (element) {
  return element.innerHTML;
};

/**
 * Set an element's inner HTML.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      html     A string of HTML to set as the innerHTML.
 */
Jymin.setHtml = function (element, html) {
  element.innerHTML = html;
};

/**
 * Get an element's lowercase tag name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's tag name.
 */
Jymin.getTag = function (element) {
  return Jymin.lower(element.tagName);
};

/**
 * Get an element's text.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's text content.
 */
Jymin.getText = function (element) {
  return element.textContent || element.innerText;
};

/**
 * Set the text of an element.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}      text     A text string to set.
 */
Jymin.setText = function (element, text) {
  Jymin.clearElement(element);
  Jymin.addText(element, text);
};

/**
 * Add text to an element.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}      text     A text string to add.
 */
Jymin.addText = function (element, text) {
  Jymin.addElement(element, document.createTextNode(text));
};

/**
 * Get an attribute from an element.
 *
 * @param  {HTMLElement} element        An element.
 * @param  {String}      attributeName  An attribute's name.
 * @return {String}                     The value of the attribute.
 */
Jymin.getAttribute = function (element, attributeName) {
  return element.getAttribute(attributeName);
};

/**
 * Set an attribute on an element.
 *
 * @param  {HTMLElement} element        An element.
 * @param  {String}      attributeName  An attribute name.
 * @param  {String}      value          A value to set the attribute to.
 */
Jymin.setAttribute = function (element, attributeName, value) {
  element.setAttribute(attributeName, value);
};

/**
 * Get a data attribute from an element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      dataKey  A data attribute's key.
 * @return {String}               The value of the data attribute.
 */
Jymin.getData = function (element, dataKey) {
  return Jymin.getAttribute(element, 'data-' + dataKey);
};

/**
 * Set a data attribute on an element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}      dataKey  A data attribute key.
 * @param  {String}      value    A value to set the data attribute to.
 */
Jymin.setData = function (element, dataKey, value) {
  Jymin.setAttribute(element, 'data-' + dataKey, value);
};

/**
 * Get an element's class name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               The element's class name.
 */
Jymin.getClass = function (element) {
  var className = element.className || '';
  return className.baseVal || className;
};

/**
 * Get an element's class name as an array of classes.
 *
 * @param  {HTMLElement} element  An element.
 * @return {Array}                The element's class name classes.
 */
Jymin.getClasses = function (element) {
  return Jymin.getClass(element).split(/\s+/);
};

/**
 * Set an element's class name.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               One or more space-delimited classes to set.
 */
Jymin.setClass = function (element, className) {
  element.className = className;
};

/**
 * Find out whether an element has a specified class.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to search for.
 * @return {boolean}                True if the class was found.
 */
Jymin.hasClass = function (element, className) {
  var classes = Jymin.getClasses(element);
  return classes.indexOf(className) > -1;
};

/**
 * Add a class to a given element.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {String}               A class to add if it's not already there.
 */
Jymin.addClass = function (element, className) {
  if (!Jymin.hasClass(element, className)) {
    element.className += ' ' + className;
  }
};

/**
 * Remove a class from a given element, assuming no duplication.
 *
 * @param  {HTMLElement} element  An element.
 * @return {String}               A class to remove.
 */
Jymin.removeClass = function (element, className) {
  var classes = Jymin.getClasses(element);
  var index = classes.indexOf(className);
  if (index > -1) {
    classes.splice(index, 1);
  }
  classes.join(' ');
  Jymin.setClass(element, classes);
};

/**
 * Turn a class on or off on a given element.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to add or remove.
 * @param  {boolean}     flipOn     Whether to add, rather than removing.
 */
Jymin.flipClass = function (element, className, flipOn) {
  var method = flipOn ? Jymin.addClass : Jymin.removeClass;
  method(element, className);
};

/**
 * Turn a class on if it's off, or off if it's on.
 *
 * @param  {HTMLElement} element    An element.
 * @param  {String}      className  A class to toggle.
 * @return {boolean}                True if the class was turned on.
 */
Jymin.toggleClass = function (element, className) {
  var flipOn = !Jymin.hasClass(element, className);
  Jymin.flipClass(element, className, flipOn);
  return flipOn;
};

/**
 * Find elements matching a selector, and return or run a function on them.
 *
 * Selectors are not fully querySelector compatible.
 * Selectors only support commas, spaces, IDs, tags & classes.
 *
 * @param  {HTMLElement}    parentElement  An optional element under which to find elements.
 * @param  {String}         selector       A simple selector for finding elements.
 * @param  {Function}       fn             An optional function to run on matching elements.
 * @return {HTMLCollection}                The matching elements (if any).
 */
Jymin.all = function (parentElement, selector, fn) {
  if (!selector || Jymin.isFunction(selector)) {
    fn = selector;
    selector = parentElement;
    parentElement = document;
  }
  var elements;
  //+browser:old
  elements = [];
  if (Jymin.contains(selector, ',')) {
    Jymin.forEach(selector, function (selector) {
      Jymin.all(parentElement, selector, function (element) {
        Jymin.push(elements, element);
      });
    });
  }
  else if (Jymin.contains(selector, ' ')) {
    var pos = selector.indexOf(' ');
    var preSelector = selector.substr(0, pos);
    var postSelector = selector.substr(pos + 1);
    elements = [];
    Jymin.all(parentElement, preSelector, function (element) {
      var children = Jymin.all(element, postSelector);
      Jymin.merge(elements, children);
    });
  }
  else if (selector[0] == '#') {
    var id = selector.substr(1);
    var child = Jymin.getElement(parentElement.ownerDocument || document, id);
    if (child) {
      var parent = Jymin.getParent(child);
      while (parent) {
        if (parent === parentElement) {
          elements = [child];
          break;
        }
        parent = Jymin.getParent(parent);
      }
    }
  }
  else {
    selector = selector.split('.');
    var tagName = selector[0];
    var className = selector[1];
    var tagElements = parentElement.getElementsByTagName(tagName);
    Jymin.forEach(tagElements, function (element) {
      if (!className || Jymin.hasClass(element, className)) {
        Jymin.push(elements, element);
      }
    });
  }
  //-browser:old
  //+browser:ok
  elements = parentElement.querySelectorAll(selector);
  //-browser:ok
  if (fn) {
    Jymin.forEach(elements, fn);
  }
  return elements;
};

/**
 * Find an element matching a selector, optionally run a function on it, and return it.
 *
 * @param  {HTMLElement} parentElement  An optional element under which to find an element.
 * @param  {String}      selector       A simple selector for finding an element.
 * @param  {Function}    fn             An optional function to run on a matching element.
 * @return {HTMLElement}                The matching element (if any).
 */
Jymin.one = function (parentElement, selector, fn) {
  if (!selector || Jymin.isFunction(selector)) {
    fn = selector;
    selector = parentElement;
    parentElement = document;
  }
  var element;
  //+browser:old
  element = Jymin.all(parentElement, selector)[0];
  //-browser:old
  //+browser:ok
  element = parentElement.querySelector(selector);
  //-browser:ok
  if (element && fn) {
    fn(element);
  }
  return element;
};


/**
 * Push new HTML into one or more selected elements.
 *
 * @param  {String} html     A string of HTML.
 * @param  {String} selector An optional selector (default: "body").
 */
Jymin.pushHtml = function (html, selector) {

  // Grab the new page title if there is one.
  var title = Jymin.getTagContents(html, 'title')[0];

  // If there's no target, we're replacing the body contents.
  if (!selector) {
    selector = 'body';
    html = Jymin.getTagContents(html, selector)[0];
  }

  // TODO: Implement a DOM diff.
  Jymin.all(selector || 'body', function (element) {

    // Set the HTML of an element.
    Jymin.setHtml(element, html);

    // If there's a title, set it.
    if (title) {
      document.title = title;
      Jymin.scrollTop(0);
    }
    Jymin.ready(element);
  });

  // Execute any scripts that are found.
  // TODO: Skip over JSX, etc.
  Jymin.getTagContents(html, 'script', Jymin.execute);
};
/**
 * Create an event emitter object, lazily loading its prototype.
 */
Jymin.Emitter = function () {
  this._events = {};
  if (!this._on) {
    Jymin.decorateObject(Jymin.Emitter.prototype, Jymin.EmitterPrototype);
  }
};

/**
 * Expose Emitter methods which can be applied lazily.
 */
Jymin.EmitterPrototype = {

  _on: function (event, fn) {
    var self = this;
    var events = self._events;
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
    var listeners = self._events[event] || [];
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

  _removeAllListeners: function (event) {
    var self = this;
    var events = self._events;
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
Jymin.FOCUS = 'focus';
Jymin.BLUR = 'blur';
Jymin.CLICK = 'click';
Jymin.MOUSEDOWN = 'mousedown';
Jymin.MOUSEUP = 'mouseup';
Jymin.MOUSEOVER = 'mouseover';
Jymin.MOUSEOUT = 'mouseout';
Jymin.KEYDOWN = 'keydown';
Jymin.KEYUP = 'keyup';
Jymin.KEYPRESS = 'keypress';

Jymin.CANCEL_BUBBLE = 'cancelBubble';
Jymin.PREVENT_DEFAULT = 'preventDefault';
Jymin.STOP_PROPAGATION = 'stopPropagation';
Jymin.ADD_EVENT_LISTENER = 'addEventListener';
Jymin.ATTACH_EVENT = 'attachEvent';
Jymin.ON = 'on';

/**
 * Bind an event listener for one or more events on an element.
 *
 * @param  {HTMLElement}  element  An element to bind an event listener to.
 * @param  {string|Array} events   An array or comma-delimited string of event names.
 * @param  {function}     listener  A function to run when the event occurs or is triggered: `listener(element, event, target)`.
 */
Jymin.bind = function (element, events, listener) {
  Jymin.forEach(events, function (event) {

    // Invoke the event listener with the event information and the target element.
    var fn = function (event) {
      // Fall back to window.event for IE.
      event = event || window.event;
      // Fall back to srcElement for IE.
      var target = event.target || event.srcElement;
      // Make sure this isn't a text node in Safari.
      if (target.nodeType == 3) {
        target = Jymin.getParent(target);
      }
      listener(element, event, target);
    };

    // Bind for emitting.
    var events = (element._events = element._events || {});
    var listeners = (events[event] = events[event] || []);
    Jymin.push(listeners, listener);

    // Bind using whatever method we can use.
    var method = Jymin.ADD_EVENT_LISTENER;
    var key;
    if (element[method]) {
      element[method](event, fn, true);
    }
    else {
      method = Jymin.ATTACH_EVENT;
      key = Jymin.ON + event;
      if (element[method]) {
        element[method](key, fn);
      }
    }
  });
};

/**
 * Bind a listener to an element to receive bubbled events from descendents matching a selector.
 *
 * @param  {HTMLElement}  element   The element to bind a listener to.
 * @param  {String}       selector  The selector for descendents.
 * @param  {String|Array} events    A list of events to listen for.
 * @param  {function} listener      A function to call on an element, event and descendent.
 */
Jymin.on = function (element, selector, events, listener) {
  if (Jymin.isFunction(events)) {
    listener = events;
    events = selector;
    selector = element;
    element = document;
  }
  Jymin.bind(element, events, function (element, event, target) {
    var trail = Jymin.getTrail(target, selector);
    Jymin.forEach(trail, function (element) {
      listener(element, event, target);
      return !event[Jymin.CANCEL_BUBBLE];
    });
  });
};

/**
 * Trigger an event on an element, and bubble it up to parent elements.
 *
 * @param  {HTMLElement}  element  Element to trigger an event on.
 * @param  {Event|string} event    Event or event type to trigger.
 * @param  {HTMLElement}  target   Fake target.
 */
Jymin.trigger = function (element, event, target) {
  if (element) {
    var type = event.type;
    event = type ? event : {type: (type = event)};
    event._triggered = true;
    target = target || element;

    var listeners = (element._events || 0)[type];
    Jymin.forEach(listeners, function (fn) {
      fn(element, event, target);
    });
    if (!event[Jymin.CANCEL_BUBBLE]) {
      Jymin.trigger(element.parentNode, event, target);
    }
  }
};

/**
 * Stop an event from bubbling up the DOM.
 *
 * @param  {Event} event  Event to stop.
 */
Jymin.stopPropagation = function (event) {
  (event || 0)[Jymin.CANCEL_BUBBLE] = true;
  Jymin.apply(event, Jymin.STOP_PROPAGATION);
};

/**
 * Prevent the default action for this event.
 *
 * @param  {Event} event  Event to prevent from doing its default action.
 */
Jymin.preventDefault = function (event) {
  Jymin.apply(event, Jymin.PREVENT_DEFAULT);
};

/**
 * Focus on a specified element.
 *
 * @param  {HTMLElement} element  The element to focus on.
 */
Jymin.focusElement = function (element) {
  Jymin.apply(element, Jymin.FOCUS);
};
/**
 * Get the value of a form element.
 *
 * @param  {HTMLElement}  input  A form element.
 * @return {String|Array}        The value of the form element (or array of elements).
 */
Jymin.getValue = function (input) {
  input = Jymin.getElement(input);
  if (input) {
    var type = input.type[0];
    var value = input.value;
    var checked = input.checked;
    var options = input.options;
    if (type == 'c' || type == 'r') {
      value = checked ? value : null;
    }
    else if (input.multiple) {
      value = [];
      Jymin.forEach(options, function (option) {
        if (option.selected) {
          Jymin.push(value, option.value);
        }
      });
    }
    else if (options) {
      value = Jymin.getValue(options[input.selectedIndex]);
    }
    return value;
  }
};

/**
 * Set the value of a form element.
 *
 * @param  {HTMLElement}  input  A form element.
 * @return {String|Array}        A value or values to set on the form element.
 */
Jymin.setValue = function (input, value) {
  input = Jymin.getElement(input);
  if (input) {
    var type = input.type[0];
    var options = input.options;
    if (type == 'c' || type == 'r') {
      input.checked = value ? true : false;
    }
    else if (options) {
      var selected = {};
      if (input.multiple) {
        Jymin.forEach(value, function (optionValue) {
          selected[optionValue] = true;
        });
      }
      else {
        selected[value] = true;
      }
      value = Jymin.isArray(value) ? value : [value];
      Jymin.forEach(options, function (option) {
        option.selected = !!selected[option.value];
      });
    }
    else {
      input.value = value;
    }
  }
};
/**
 * Apply arguments to an object method.
 *
 * @param  {Object}          object      An object with methods.
 * @param  {string}          methodName  A method name, which may exist on the object.
 * @param  {Arguments|Array} args        An arguments object or array to apply to the method.
 * @return {Object}                      The result returned by the object method.
 */
Jymin.apply = function (object, methodName, args) {
  return ((object || 0)[methodName] || Jymin.doNothing).apply(object, args);
};
/**
 * Return a history object.
 */
Jymin.getHistory = function () {
  var history = window.history || {};
  Jymin.forEach(['push', 'replace'], function (key) {
    var fn = history[key + 'State'];
    history[key] = function (href) {
      if (fn) {
        fn.apply(history, [null, null, href]);
      } else {
        // TODO: Create a backward compatible history push.
      }
    };
  });
  return history;
};

/**
 * Push an item into the history.
 */
Jymin.historyPush = function (href) {
  Jymin.getHistory().push(href);
};

/**
 * Replace the current item in the history.
 */
Jymin.historyReplace = function (href) {
  Jymin.getHistory().replace(href);
};

/**
 * Go back.
 */
Jymin.historyPop = function () {
  Jymin.getHistory().back();
};

/**
 * Listen for a history change.
 */
Jymin.onHistoryPop = function (callback) {
  Jymin.bind(window, 'popstate', callback);
};
/**
 * The values in this file can be overridden externally.
 * The default locale is US. Sorry, World.
 */

/**
 * Month names in English.
 * @type {Array}
 */
Jymin.i18nMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * The word "at" in English (for separating date & time).
 * @type {String}
 */
Jymin.i18nAt = 'at';

/**
 * Whether to show dates in DD/MM/YYYY format.
 * @type {Booly}
 */
Jymin.i18nDayMonthYear = 0;

/**
 * Whether to show times in 24-hour format.
 * @type {Booly}
 */
Jymin.i18n24Hour = 0;

/**
 * Why oh why did I have to learn different units than the rest of the world?
 * @type {String}
 */
Jymin.i18nTemperature = 'F';
/**
 * Create a circular-safe JSON string.
 */
Jymin.safeStringify = function (data, stack) {
  if (Jymin.isString(data)) {
    data = '"' + data.replace(/\n\r"/g, function (c) {
      return c == '\n' ? '\\n' : c == '\r' ? '\\r' : '\\"';
    }) + '"';
  }
  else if (Jymin.isFunction(data) || Jymin.isUndefined(data) || (data === null)) {
    return null;
  }
  else if (data && Jymin.isObject(data)) {
    stack = stack || [];
    var isCircular;
    Jymin.forEach(stack, function (item) {
      if (item == data) {
        isCircular = 1;
      }
    });
    if (isCircular) {
      return null;
    }
    Jymin.push(stack, data);
    var parts = [];
    var before, after;
    if (Jymin.isArray(data)) {
      before = '[';
      after = ']';
      Jymin.forEach(data, function (value) {
        Jymin.push(parts, Jymin.stringify(value, stack));
      });
    }
    else {
      before = '{';
      after = '}';
      Jymin.forIn(data, function (key, value) {
        Jymin.push(parts, Jymin.stringify(key) + ':' + Jymin.stringify(value, stack));
      });
    }
    Jymin.pop(stack);
    data = before + parts.join(',') + after;
  }
  else {
    data = '' + data;
  }
  return data;
};

/**
 * Create a JSON string.
 */
Jymin.stringify = function (data) {
  var json;
  //+browser:old
  json = Jymin.safeStringify(data);
  //-browser:old
  //+browser:ok
  json = JSON.stringify(data);
  //-browser:ok
};

/**
 * Parse JavaScript and return a value.
 */
Jymin.parse = function (value, alternative) {
  try {
    var evil = window.eval; // jshint ignore:line
    evil('eval.J=' + value);
    value = evil.J;
  }
  catch (e) {
    //+env:debug
    Jymin.error('[Jymin] Could not parse JS: ' + value);
    //-env:debug
    value = alternative;
  }
  return value;
};

/**
 * Execute JavaScript.
 */
Jymin.execute = function (text) {
  Jymin.parse('0;' + text);
};

/**
 * Parse a value and return a boolean no matter what.
 */
Jymin.parseBoolean = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isBoolean(value) ? value : (alternative || false);
};

/**
 * Parse a value and return a number no matter what.
 */
Jymin.parseNumber = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isNumber(value) ? value : (alternative || 0);
};

/**
 * Parse a value and return a string no matter what.
 */
Jymin.parseString = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isString(value) ? value : (alternative || '');
};

/**
 * Parse a value and return an object no matter what.
 */
Jymin.parseObject = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isObject(value) ? value : (alternative || {});
};

/**
 * Parse a value and return a number no matter what.
 */
Jymin.parseArray = function (value, alternative) {
  value = Jymin.parse(value);
  return Jymin.isObject(value) ? value : (alternative || []);
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
 * Scroll the top of the page to a specified Y position.
 *
 * @param  {Integer} top  A specified Y position, in pixels.
 */
Jymin.scrollTop = function (top) {
  document.body.scrollTop = (document.documentElement || 0).scrollTop = top;
};

/**
 * Scroll the top of the page to a specified named anchor.
 *
 * @param  {String} name  The name of an HTML anchor.
 * @return {String}
 */
Jymin.scrollToAnchor = function (name) {
  var offset = 0;
  var element;
  //+browser:old
  Jymin.all('a', function (anchor) {
    if (anchor.name == name) {
      element = anchor;
    }
  });
  //-browser:old
  //+browser:ok
  element = Jymin.all('a[name=' + name + ']')[0];
  //-browser:ok
  while (element) {
    offset += element.offsetTop || 0;
    element = element.offsetParent || 0;
  }
  Jymin.scrollTop(offset - (Jymin.body._.offsetTop || 0));
};
/**
 * If the argument is numeric, return a number, otherwise return zero.
 *
 * @param  {Object} number  An object to convert to a number, if necessary.
 * @return {number}         The number, or zero.
 */
Jymin.ensureNumber = function (number) {
  return isNaN(number *= 1) ? 0 : number;
};

/**
 * Left-pad a number with zeros if it's shorter than the desired length.
 *
 * @param  {number} number  A number to pad.
 * @param  {number} length  A length to pad to.
 * @return {String}         The zero-padded number.
 */
Jymin.zeroFill = function (number, length) {
  number = '' + number;
  // Repurpose the lenth variable to count how much padding we need.
  length = Math.max(length - Jymin.getLength(number), 0);
  return (new Array(length + 1)).join('0') + number;
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
 * Execute a function when the page loads or new content is added.
 *
 * @param  {Function}  fn  A function which will receive a ready element.
 */
Jymin.onReady = function (fn) {

  // If the document is ready, run the function now.
  if (document._isReady) {
    fn(document);
  }

  // Otherwise, bind the ready handler.
  else {
    Jymin.bindReady(document, function () {
      Jymin.trigger(document, 'ready');
    });
  }

  // Bind to the document's Jymin-triggered ready event.
  Jymin.bind(document, 'ready', fn);
};

/**
 * Bind to the appropriate ready event for an element.
 * This works for the document as well as for scripts.
 *
 * @param  {HTMLElement} element  An element to bind to.
 * @param  {Function}    fn       A function to run when the element is ready.
 */
Jymin.bindReady = function (element, fn) {

  // Create a listener that replaces itself so it will only run once.
  var onLoad = function () {
    if (Jymin.isReady(element)) {
      onLoad = Jymin.doNothing;
      window.onload = element.onload = element.onreadystatechange = null;
      fn(element);
    }
  };

  // Bind to the document in MSIE8, or scripts in other browsers.
  Jymin.bind(element, 'readystatechange', onLoad);
  if (element == document) {
    // Bind to the document in newer browsers.
    Jymin.bind(element, 'DOMContentLoaded', onLoad);
  }
  // Fall back.
  Jymin.bind(element == document ? window : element, 'load', onLoad);
};

/**
 * Declare an object to be ready, and run events that have been bound to it.
 *
 * @param  {Any} thing  An HTMLElement or other object.
 */
Jymin.ready = function (thing) {
  thing._isReady = 1;
  Jymin.trigger(thing, 'ready');
};

/**
 * Check if a document, iframe, script or AJAX response is ready.
 * @param  {Object}  object [description]
 * @return {Boolean}        [description]
 */
Jymin.isReady = function (object) {
  // AJAX requests have readyState 4 when loaded.
  // All documents will reach readyState=="complete".
  // In IE, scripts can reach readyState=="loaded" or readyState=="complete".
  // In non-IE browsers, we can bind to script.onload instead of checking script.readyState.
  return /(4|complete|scriptloaded)$/.test('' + object.tagName + object.readyState);
};

/**
 * Insert an external JavaScript file.
 *
 * @param  {HTMLElement} element  An element.
 * @param  {HTMLElement} element  An element.
 * @param  {String}      src      A source URL of a script to insert.
 * @param  {function}    fn       An optional function to run when the script loads.
 */
Jymin.insertScript = function (src, fn) {
  var head = Jymin.all('head')[0];
  var script = Jymin.addElement(head, 'script');
  if (fn) {
    Jymin.bindReady(script, fn);
  }
  script.src = src;
};
/**
 * Get the contents of a specified type of tag within a string of HTML.
 *
 * @param  {String}   html    [description]
 * @param  {String}   tagName [description]
 * @param  {Function} fn      [description]
 * @return {Array}           [description]
 */
Jymin.getTagContents = function (html, tagName, fn) {
  var pattern = new RegExp('<' + tagName + '.*?>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  var contents = [];
  html.replace(pattern, function (match, content) {
    contents.push(content);
    if (fn) {
      fn(content);
    }
  });
  return contents;
};
/**
 * Get the local storage object.
 *
 * @return {Object}  The local storage object.
 */
Jymin.getStorage = function () {
  return window.localStorage;
};

/**
 * Fetch an item from local storage.
 *
 * @param  {String} key  A key to fetch an object by
 * @return {Any}         The object that was fetched and deserialized
 */
Jymin.fetch = function (key) {
  var storage = Jymin.getStorage();
  return storage ? Jymin.parse(storage.getItem(key)) : 0;
};

/**
 * Store an item in local storage.
 *
 * @param  {String} key    A key to store and fetch an object by
 * @param  {Any}    value  A value to be stringified and stored
 */
Jymin.store = function (key, value) {
  var storage = Jymin.getStorage();
  if (storage) {
    storage.setItem(key, Jymin.stringify(value));
  }
};
/**
 * Ensure a value is a string.
 */
Jymin.ensureString = function (value) {
  return Jymin.isString(value) ? value : '' + value;
};

/**
 * Return true if the string contains the given substring.
 */
Jymin.contains = function (string, substring) {
  return Jymin.ensureString(string).indexOf(substring) > -1;
};

/**
 * Return true if the string starts with the given substring.
 */
Jymin.startsWith = function (string, substring) {
  return Jymin.ensureString(string).indexOf(substring) == 0; // jshint ignore:line
};

/**
 * Trim the whitespace from a string.
 */
Jymin.trim = function (string) {
  return Jymin.ensureString(string).replace(/^\s+|\s+$/g, '');
};

/**
 * Split a string by commas.
 */
Jymin.splitByCommas = function (string) {
  return Jymin.ensureString(string).split(',');
};

/**
 * Split a string by spaces.
 */
Jymin.splitBySpaces = function (string) {
  return Jymin.ensureString(string).split(' ');
};

/**
 * Return a string, with asterisks replaced by values from a replacements array.
 */
Jymin.decorateString = function (string, replacements) {
  string = Jymin.ensureString(string);
  Jymin.forEach(replacements, function(replacement) {
    string = string.replace('*', replacement);
  });
  return string;
};

/**
 * Perform a RegExp Jymin.match, and call a callback on the result;
  */
Jymin.match = function (string, pattern, callback) {
  var result = string.match(pattern);
  if (result) {
    callback.apply(string, result);
  }
};

/**
 * Reduce a string to its alphabetic characters.
 */
Jymin.extractLetters = function (string) {
  return Jymin.ensureString(string).replace(/[^a-z]/ig, '');
};

/**
 * Reduce a string to its numeric characters.
 */
Jymin.extractNumbers = function (string) {
  return Jymin.ensureString(string).replace(/[^0-9]/g, '');
};

/**
 * Returns a lowercase string.
 */
Jymin.lower = function (object) {
  return Jymin.ensureString(object).toLowerCase();
};

/**
 * Returns an uppercase string.
 */
Jymin.upper = function (object) {
  return Jymin.ensureString(object).toUpperCase();
};

/**
 * Return an escaped value for URLs.
 */
Jymin.escape = function (value) {
  return '' + encodeURIComponent('' + value);
};

/**
 * Return an unescaped value from an escaped URL.
 */
Jymin.unescape = function (value) {
  return '' + decodeURIComponent('' + value);
};

/**
 * Returns a query string generated by serializing an object and joined using a delimiter (defaults to '&')
 */
Jymin.buildQueryString = function (object) {
  var queryParams = [];
  Jymin.forIn(object, function(key, value) {
    queryParams.push(Jymin.escape(key) + '=' + Jymin.escape(value));
  });
  return queryParams.join('&');
};

/**
 * Return the browser version if the browser name matches or zero if it doesn't.
 */
Jymin.getBrowserVersionOrZero = function (browserName) {
  var match = new RegExp(browserName + '[ /](\\d+(\\.\\d+)?)', 'i').exec(navigator.userAgent);
  return match ? +Jymin.match[1] : 0;
};
/**
 * Set or reset a timeout or interval, and save it for possible cancellation.
 * The timer can either be added to the setTimer method itself, or it can
 * be added to an object provided (such as an HTMLElement).
 *
 * @param {Object|String} objectOrString  An object to bind a timer to, or a name to call it.
 * @param {Function}      fn              A function to run if the timer is reached.
 * @param {Integer}       delay           An optional delay in milliseconds.
 */
Jymin.setTimer = function (objectOrString, fn, delay, isInterval) {
  var useString = Jymin.isString(objectOrString);
  var object = useString ? Jymin.setTimer : objectOrString;
  var key = useString ? objectOrString : '_timeout';
  clearTimeout(object[key]);
  if (fn) {
    if (Jymin.isUndefined(delay)) {
      delay = 9;
    }
    object[key] = (isInterval ? setInterval : setTimeout)(fn, delay);
  }
};

/**
 * Remove a timer from an element or from the Jymin.setTimer method.
 *
 * @param {Object|String} objectOrString  An object or a timer name.
 */
Jymin.clearTimer = function (objectOrString) {
  Jymin.setTimer(objectOrString);
};
/**
 * Check whether a value is of a given primitive type.
 *
 * @param  {Any}     value  A value to check.
 * @param  {Any}     type   The primitive type.
 * @return {boolean}        True if the value is of the given type.
 */
Jymin.isType = function (value, type) {
  return typeof value == type;
};

/**
 * Check whether a value is undefined.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is undefined.
 */
Jymin.isUndefined = function (value) {
  return typeof value == 'undefined';
};

/**
 * Check whether a value is a boolean.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a boolean.
 */
Jymin.isBoolean = function (value) {
  return typeof value == 'boolean';
};

/**
 * Check whether a value is a number.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a number.
 */
Jymin.isNumber = function (value) {
  return typeof value == 'number';
};

/**
 * Check whether a value is a string.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a string.
 */
Jymin.isString = function (value) {
  return typeof value == 'string';
};

/**
 * Check whether a value is a function.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a function.
 */
Jymin.isFunction = function (value) {
  return typeof value == 'function';
};

/**
 * Check whether a value is an object.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an object.
 */
Jymin.isObject = function (value) {
  return typeof value == 'object';
};

/**
 * Check whether a value is null.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is null.
 */
Jymin.isNull = function (value) {
  return value === null;
};

/**
 * Check whether a value is an instance of a given type.
 *
 * @param  {Any}      value        A value to check.
 * @param  {Function} Constructor  A constructor for a type of object.
 * @return {boolean}               True if the value is an instance of a given type.
 */
Jymin.isInstance = function (value, Constructor) {
  return value instanceof Constructor;
};

/**
 * Check whether a value is an array.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an array.
 */
Jymin.isArray = function (value) {
  return Jymin.isInstance(value, Array);
};

/**
 * Check whether a value is a date.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a date.
 */
Jymin.isDate = function (value) {
  return Jymin.isInstance(value, Date);
};

/**
 * Check whether a value is an error.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is an error.
 */
Jymin.isError = function (value) {
  return Jymin.isInstance(value, Error);
};

/**
 * Check whether a value is a regular expression.
 *
 * @param  {Any}     value  A value to check.
 * @return {boolean}        True if the value is a regular expression.
 */
Jymin.isRegExp = function (value) {
  return Jymin.isInstance(value, RegExp);
};
/**
 * Get the current location host.
 */
Jymin.getHost = function () {
  return location.host;
};

/**
 * Get the base of the current URL.
 */
Jymin.getBaseUrl = function () {
  return location.protocol + '//' + Jymin.getHost();
};

/**
 * Get the query parameters from a URL.
 */
Jymin.getQueryParams = function (url) {
  url = url || location.href;
  var query = url.substr(url.indexOf('?') + 1).split('#')[0];
  var pairs = query.split('&');
  query = {};
  Jymin.forEach(pairs, function (pair) {
    var eqPos = pair.indexOf('=');
    var name = pair.substr(0, eqPos);
    var value = pair.substr(eqPos + 1);
    query[name] = value;
  });
  return query;
};

/**
 * Get the query parameters from the hash of a URL.
 */
Jymin.getHashParams = function (hash) {
  hash = (hash || location.hash).replace(/^#/, '');
  return hash ? Jymin.getQueryParams(hash) : {};
};

