module.exports = {

	get: function (path, callback) {
		this._get = callback;
	},

	post: function (path, callback) {
		this._post = callback;
	}

};