(function() {
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
        var createLoadStyle = function(url) {
            var style = styleManager.styles[url];
            var loadStyle = new Promise(function(resolve, reject) {
                if (style) {
                    style.count++;
                    style.loader.then(resolve);
                } else {
                    var stylesheet = document.createElement("link");
                    stylesheet.rel = 'stylesheet';
                    stylesheet.href = url;
                    stylesheet.onload = function() {
                        if (debug) {
                            console.log('style [' + url + '] loaded');
                        }
                        resolve();
                    };
                    styleManager.styles[url] = {
                        element: stylesheet,
                        count: 1
                    };
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.appendChild(stylesheet);
                }
            });
            if (!style) {
                styleManager.styles[url].loader = loadStyle;
            }
            loadStyles.push(loadStyle);
        };
        for (var i = 0; i < length; i++) {
            var url = urls[i];
            createLoadStyle(url);
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
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.removeChild(style.element);
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
        var createLoadScript = function(url) {
            var loadScript = new Promise(function(resolve, reject) {
                var loader = scriptLoader.loaders[url];
                if (loader) {
                    loader.then(resolve);
                } else {
                    var script = document.createElement("script");
                    script.src = url;
                    var loaded = false;
                    script.onload = script.onreadystatechange = function(e) {
                        if (loaded) {
                            return;
                        }
                        if (!this.readyState || this.readyState === 'loaded') {
                            loaded = true;
                            if (debug) {
                                console.log('script [' + url + '] loaded');
                            }
                            resolve();
                        }
                        else {
                            return;
                        }
                    };
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.appendChild(script);
                }
            });
            scriptLoader.loaders[url] = loadScript;
            loadScripts.push(loadScript);
        };
        for (var i = 0; i < length; i++) {
            var url = urls[i];
            createLoadScript(url);
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
        if (typeof options !== 'object') {
            options = {};
        }

        this.id = id;
        this.children = {};
        this.document = null;
        this.scripts = options.scripts;
        this.styles = options.styles;
        this.initScript = options.initScript;
        this.callback = options.callback;
        this.events = {};
        this.appended = false;

        if (id === '__root') {
            this.appended = true;
            pagelets[id] = this;
            return;
        }

        var parentId = options.parentId;
        if (!parentId) {
            parentId = '__root';
        }
        this._parentId = parentId;
        this._loadStyle().then(function() {
            if (!pagelets[parentId]) {
                //parent not ready yet
                if (orphanPagelets[parentId]) {
                    orphanPagelets[parentId].push(this);
                } else {
                    orphanPagelets[parentId] = [this];
                }
            } else {
                this._init();
                pagelets[this.id] = this;
            }
        }.bind(this));

    };

    Pagelet.prototype = {
        _init: function() {
            this._setParent(this._parentId);
            this.appendTo(this.parent());
            this._loadScript().then(this._executeInitScript.bind(this))
                .then(function() {
                    this.appended = true;
                    if (typeof this.callback === 'function') {
                        this.callback(this);
                    }
                }.bind(this));
        },
        _setParent: function(id) {
            this._parent = pagelets[id];
            this._parent.children[this.id] = this;
        },
        _loadStyle: function() {
            if (this.styles) {
                return styleManager.load(this.styles);
            } else {
                return Promise.resolve();
            }
        },
        _loadScript: function() {
            if (this.scripts) {
                return scriptLoader.load(this.scripts);
            } else {
                return Promise.resolve();
            }
        },
        _executeInitScript: function() {
            if (typeof this.initScript === 'string') {
                eval(this.initScript);
            }
        },
        _getPlaceholder: function(document) {
            if (!document.getElementById) {
                document = window.document;
            }
            return document.getElementById('pagelet_' + this.id);
        },
        _getHTML: function() {
            var container = document.getElementById('pagelethtml_' + this.id);
            if (!container) {
                return false;
            }
            return container.innerHTML.trim().match(/^<!--([\s\S]*)-->$/)[1];
        },
        parent: function() {
            return pagelets[this._parentId] || pagelets.__root;
        },
        children: function() {

        },
        appendTo: function(pagelet) {
            if (!pagelet instanceof Pagelet) {
                throw new Error(pagelet + 'is not a pagelet.');
            }
            var html = this._getHTML();
            if (!html) {
                return;
            }
            if (!pagelet.document) {
                throw new Error('Cannot append pagelet[' + this.id + '] to documentless pagelet[' + pagelet.id + ']');
            } else {
                this.document = this._getPlaceholder(pagelet.document);
                this.document.innerHTML = html;
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

    var __rootPagelet = new Pagelet('__root');
    __rootPagelet.document = document;

    var Bigpipe = {};

    Bigpipe.register = function(id, options, callback) {
        if (typeof options !== 'object') {
            options = {};
        }
        options.callback = callback;
        pagelets[id] = new Pagelet(id, options);
    };
    Bigpipe.config = function(options) {
        if (typeof options._getHTML === 'function') {
            Pagelet.prototype._getHTML = options._getHTML;
        }
        if (typeof options._getPlaceholder === 'function') {
            Pagelet.prototype._getPlaceholder = options._getPlaceholder;
        }
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

    var global = this;
    global.Bigpipe = Bigpipe;

}).call(this);
