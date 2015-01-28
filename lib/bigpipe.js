(function(global) {
	"use strict";

	var debug = false;

	var styleManager = {
		styles: {}
	};
	styleManager._getUrl = function(ids) {
		return ids;
	};
	styleManager.load = function(ids) {
		if (!(ids instanceof Array)) {
			ids = [ids];
		}
		var urls = this._getUrl(ids);
		var loadStyles = [];
		var length = urls.length;
		for (var i = 0; i < length; i++) {
			var url = urls[i];
			(function(url) {
				var loadStyle = new Promise(function(resolve, reject) {
					var style = styleManager.styles[url];
					if (style) {
						style.count++;
						resolve();
					} else {
						var stylesheet = window.document.createElement("link");
						stylesheet.rel = 'stylesheet';
						stylesheet.href = url;
						stylesheet.onload = stylesheet.onreadystatechange = function(e) {
							console.log(e);
							styleManager.styles[url] = {
								element: stylesheet,
								count: 1
							};
							if (debug) {
								console.log('style [' + url + '] loaded');
							}
							resolve();
						};
						document.head.appendChild(stylesheet);
					}
				});
				loadStyles.push(loadStyle);
			})(url);
		}
		return Promise.all(loadStyles);
	};
	styleManager.unload = function(ids) {
		if (!(ids instanceof Array)) {
			ids = [ids];
		}
		var urls = this._getUrl(ids);
		var loadStyles = [];
		for (var i = urls.length - 1; i >= 0; i--) {
			var url = urls[i];
			var style = styleManager.styles[url];
			if (style) {
				style.count--;
				if (style.count === 0) {
					document.head.removeChild(style.element);
					delete style.element;
					delete styleManager.styles[url];
					if (debug) {
						console.log('style [' + url + '] unloaded');
					}
				}
			}
		}
		return new Promise(function(resolve, reject) {
			setTimeout(function() {
				resolve();
			}, 0);
		});
	};

	var scriptLoader = {};
	scriptLoader._getUrl = function(ids) {
		return ids;
	};
	scriptLoader.load = function(ids) {
		if (!(ids instanceof Array)) {
			ids = [ids];
		}
		var urls = this._getUrl(ids);
		var loadScripts = [];
		var length = urls.length;
		for (var i = 0; i < length; i++) {
			var url = urls[i];
			(function(url) {
				var loadScript = new Promise(function(resolve, reject) {
					var script = window.document.createElement("script");
					script.src = url;
					script.onload = script.onreadystatechange = function(e) {
						if (debug) {
							console.log('style [' + url + '] loaded');
						}
						resolve();
					};
					document.head.appendChild(script);
				});
				loadScripts.push(loadScript);
			})(url);
		}
		return Promise.all(loadScripts);
	};

	var pagelets = [];

	var Bigpipe = {};

	var Pagelet = function(id, options) {

	};

	Pagelet.prototype = {

	};

	Bigpipe.debug = function(value) {
		if (value === true) {
			debug = true;
			Bigpipe.Pagelet = Pagelet;
			Bigpipe.pagelets = pagelets;
			Bigpipe.styleManager = styleManager;
			Bigpipe.scriptLoader = scriptLoader;
		} else {
			debug = false;
			delete Bigpipe.Pagelet;
			delete Bigpipe.pagelets;
			delete Bigpipe.styleManager;
			delete Bigpipe.scriptLoader;
		}
	};

	global.Bigpipe = Bigpipe;

})(window);
