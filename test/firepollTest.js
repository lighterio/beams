var assert = require('assert-plus');
var firepoll = require('../firepoll');
var fs = require('fs');

describe('API', function () {
	var packageJson = require('../package.json');
	describe('version', function () {
		var packageVersion = packageJson.version;
		it('should match package.json version (' + packageVersion + ')', function () {
			var firepollVersion = firepoll.version;
			assert.equal(firepollVersion, packageVersion);
		});
	});
	describe('package.json', function () {
		it('should be unchanged after parsing and stringifying with 2 spaces', function (done) {
			fs.readFile('package.json', function (err, content) {
				if (err) {
					throw err;
				}
				content = '' + content;
				var json = JSON.parse(content);
				var clean = JSON.stringify(json, null, '  ');

				// If the content isn't equivalent to itself parsed and
				// stringified with 2 spaces, save the clean version over it.
				if (content != clean) {
					fs.writeFile('package.json', clean, function (err) {
						if (err) {
							throw err;
						}
						console.log('Fixed package.json')
						done();
					});
				}
				// If package.json doesn't need any changes, we're done.
				else {
					done();
				}
			});
		});
	});
});