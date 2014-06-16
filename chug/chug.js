var cwd = process.cwd();

exports.version = require('../package.json').version;

require('figlet').text('Beams Client v' + exports.version, {font: 'Standard'}, function (err, figlet) {

  figlet = figlet.replace(/\n/g, '\n *');

  var source = require('chug')([
    'node_modules/jymin/scripts/ajax.js',
    'node_modules/jymin/scripts/collections.js',
    'node_modules/jymin/scripts/dates.js',
    'node_modules/jymin/scripts/logging.js',
    'node_modules/jymin/scripts/strings.js',
    'node_modules/jymin/scripts/types.js',
    'scripts/beams-jymin.js'
  ]);

  source.concat('beams.js')
    .each(function (asset) {
      var locations = source.getLocations();
      locations.forEach(function (location, index) {
        locations[index] = location.replace(
          /^.*\/(node_modules|[Ww]ork[Ss]?p?a?c?e?)\/([a-z]+)\/(.*?)$/,
          ' *   https://github.com/zerious/$2/blob/master/$3');
      });
      asset.setContent((
        "/**\n" +
        " *" + figlet + "\n" +
        " *\n" +
        " * http://lighter.io/beams\n" +
        " * MIT License\n" +
        " *\n" +
        " * Source files:\n" +
        locations.join("\n") + "\n" +
        " */\n\n\n" +
        asset.getContent() + "\n" +
        "window.Beams = Beams;\n").replace(/[\t ]*\n/g, '\n'));
    })
    .wrap('window')
    .minify()
    .write(cwd, 'beams-client.js')
    .write(cwd, 'beams-client.min.js', 'minified');

});
