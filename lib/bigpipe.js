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
                var style = styleManager.styles[url];
                var loadStyle = new Promise(function(resolve, reject) {
                    if (style) {
                        style.count++;
                        style.loader.then(resolve);
                    } else {
                        var stylesheet = window.document.createElement("link");
                        stylesheet.rel = 'stylesheet';
                        stylesheet.href = url;
                        stylesheet.onload = stylesheet.onreadystatechange = function(e) {
                            if (debug) {
                                console.log('style [' + url + '] loaded');
                            }
                            resolve();
                        };
                        styleManager.styles[url] = {
                            element: stylesheet,
                            count: 1
                        };
                        document.head.appendChild(stylesheet);
                    }
                });
                if (!style) {
                    styleManager.styles[url].loader = loadStyle;
                }
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
        return Promise.resolve();
    };
    styleManager.config = function(options) {
        if (typeof options !== 'object') {
            return;
        }
        if (typeof options.urlsGenerator === 'function') {
            styleManager._getUrl = options.urlsGenerator;
        }
    };

    var scriptLoader = {
        loaders: {}
    };
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
                    var loader = scriptLoader.loaders[url];
                    if (loader) {
                        loader.then(resolve);
                    } else {
                        var script = window.document.createElement("script");
                        script.src = url;
                        script.onload = script.onreadystatechange = function(e) {
                            if (debug) {
                                console.log('script [' + url + '] loaded');
                            }
                            resolve();
                        };
                        document.head.appendChild(script);
                    }
                });
                scriptLoader.loaders[url] = loadScript;
                loadScripts.push(loadScript);
            })(url);
        }
        return Promise.all(loadScripts);
    };
    scriptLoader.config = function(options) {
        if (typeof options !== 'object') {
            return;
        }
        if (typeof options.urlsGenerator === 'function') {
            scriptLoader._getUrl = options.urlsGenerator;
        }
    };

    var pagelets = {};
    //pagelets who needs a parent to appendTo
    //organized by parent id
    var orphanPagelets = {};

    var Pagelet = function(id, options) {
        if (typeof id !== 'string') {
            throw new Error('pagelet id must be a String.');
        }
        if (pagelets[id]) {
            throw new Error('pagelet[' + id + '] already exists.');
        }

        this.id = id;
        this.parent = null;
        this.children = {};
        this.document = null;
        this.scripts = options.scripts;
        this.styles = options.styles;
        this.inlineScript = options.inlineScript;
        this.events = {};
        this.appended = false;

        this._loadStyle();
        this._loadScript();
        var parentId = options.parentId;
        if (parentId) {
            if (pagelets[parentId]) {

            }
        }

    };

    Pagelet.prototype = {
        _setParent: function(id) {

        },
        _loadStyle: function() {
            if (this.styles) {
                return styleManager.load(this.styles);
            } else {
                return Promise.resolve();
            }
        },
        _loadScript: function() {

        },
        parent: function() {

        },
        children: function() {

        },
        appendTo: function(pagelet) {
            if (!pagelet instanceof Pagelet) {
                throw new Error(pagelet + 'is not a pagelet.');
            }
        },
        destroy: function() {

        },
        replaceWith: function(id) {

        },
        reload: function() {

        },
        on: function(event, handler) {
            return this;
        },
        off: function(event, handler) {
            return this;
        },
        trigger: function(event) {
            return this;
        }
    };

    var Bigpipe = {};

    Bigpipe.register = function(id, options, callback) {
        pagelets[id] = new Pagelet(id, options);
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
