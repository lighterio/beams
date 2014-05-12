var cwd = process.cwd();

exports.version = require('../package.json').version;

require('figlet').text('Beams Client v' + exports.version, {font: 'Standard'}, function (err, figlet) {

	figlet = figlet.replace(/\n/g, '\n *');

	var source = require('chug')([
		'node_modules/jymin/core/ajax.js',
		'node_modules/jymin/core/collections.js',
		'node_modules/jymin/core/logging.js',
		'scripts/beams-jymin.js'
	]);

	source.concat('beams.js')
		.each(function (asset) {
			var locations = source.getLocations();
			locations.forEach(function (location, index) {
				locations[index] = location.replace(
					/^.*\/node_modules\/([a-z]+)\/(.*?)$/,
					' *   https://github.com/zerious/$1/blob/master/$2');
			});
			asset.setContent(
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
					"window.getBeams = getBeams;\n");
		})
		.wrap('window')
		.minify()
		.each(function (asset) {
			asset.content = addEval(asset.content);
			asset.minifiedContent = addEval(asset.minifiedContent);
		})
		.write(cwd, 'beams-client.js')
		.write(cwd, 'beams-client.min.js', 'minified');

});

function addEval(code) {
	return code.replace(
		/([$_a-z]+) ?= ?JSON\.parse\(([$_a-z]+)\)/i,
		'eval("eval.J="+$2);$1=eval.J');
}

