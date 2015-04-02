(function() {
    "use strict";

    var debug = false;

    var styleManager = {
        _styles: {}
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
            var style = styleManager._styles[url];
            var loadStyle = new Promise(function(resolve) {
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
                    styleManager._styles[url] = {
                        element: stylesheet,
                        count: 1
                    };
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.appendChild(stylesheet);
                }
            });
            if (!style) {
                styleManager._styles[url].loader = loadStyle;
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
        for (var i = urls.length - 1; i >= 0; i--) {
            var url = urls[i];
            var style = styleManager._styles[url];
            if (style) {
                style.count--;
                if (style.count === 0) {
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.removeChild(style.element);
                    delete style.element;
                    delete styleManager._styles[url];
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
        _loaders: {}
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
            var loadScript = new Promise(function(resolve) {
                var loader = scriptLoader._loaders[url];
                if (loader) {
                    loader.then(resolve);
                } else {
                    var script = document.createElement("script");
                    script.src = url;
                    script.onload = function() {
                        if (debug) {
                            console.log('script [' + url + '] loaded');
                        }
                        resolve();
                    };
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.appendChild(script);
                }
            });
            scriptLoader._loaders[url] = loadScript;
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
    //pagelets who need a parent to appendTo
    //organized by parent id
    var orphanPagelets = {};

    /**
     * Pagelet
     *
     * @class Pagelet
     * @param  {string} id
     * @param  {object} options description
     */
    function Pagelet(id, options) {
        if (typeof id !== 'string') {
            throw new Error('pagelet id must be a String.');
        }
        if (pagelets[id]) {
            throw new Error('pagelet[' + id + '] already exists.');
        }
        if (typeof options !== 'object') {
            options = {};
        }

        /**
         * @public
         * @type string
         */
        this.id = id;
        this.children = {};
        this.document = null;
        this.scripts = options.scripts;
        this.styles = options.styles;
        this._eventHandlers = {};
        this.mounted = false;

        if (id === '__root') {
            this.mounted = true;
            pagelets[id] = this;
            return;
        }

        var parentId = options.parent;
        if (!parentId) {
            parentId = '__root';
        }
        this._parentId = parentId;

        this.promise = this._init();
    }

    Pagelet.prototype = {
        _init: function() {
            var styleLoader = this._loadStyle(),
                scriptLoader = this._loadScript();

            var mounter = new Promise(function(resolve) {
                this.resolveMounter = resolve;
                styleLoader.then(function() {
                    var parentId = this._parentId;
                    if (!(pagelets[parentId] && pagelets[parentId].mounted)) {
                        //parent not ready yet
                        if (orphanPagelets[parentId]) {
                            orphanPagelets[parentId].push(this);
                        } else {
                            orphanPagelets[parentId] = [this];
                        }
                    } else {
                        this.mount();
                    }
                }.bind(this));
            }.bind(this));

            return Promise.all([mounter, scriptLoader]);
        },
        _setParent: function(id) {
            this.parent = pagelets[id];
            this.parent.children[this.id] = this;
            return this;
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
        _getPlaceholder: function(document) {
            if (!document.getElementById) {
                document = window.document;
            }
            return document.getElementById('pagelet_' + this.id);
        },
        _getHTML: function() {
            var htmlContainer = document.getElementById('pagelethtml_' + this.id);
            if (!htmlContainer) {
                return false;
            }
            var result = htmlContainer.innerHTML.trim().match(/^<!--([\s\S]*)-->$/);
            if (result) {
                return result[1];
            }
            else {
                return '';
            }
        },
        /**
         * mount - 挂载 pagelet
         *
         * @return {Pagelet}  self
         */

        mount: function() {
            this._setParent(this._parentId);
            this._appendTo(this.parent);
            if (orphanPagelets[this.id]) {
                var childrenPagelets = orphanPagelets[this.id];
                for (var i = childrenPagelets.length - 1; i >= 0; i--) {
                    childrenPagelets[i].mount();
                }
            }
            this.mounted = true;
            this.resolveMounter();
            delete this.resolveMounter;
            return this;
        },
        /**
         * _appendTo - description
         *
         * @param  {Pagelet} pagelet 挂载到的 pagelet
         * @return {Pagelet}         self
         */
        _appendTo: function(pagelet) {
            if (!pagelet instanceof Pagelet) {
                throw new Error(pagelet + 'is not a pagelet.');
            }
            if (this._mounted) {
                throw new Error('pagelet[' + this.id + '] is already mounted');
            }
            var html = this._getHTML();
            if (html !== false) {
                if (!pagelet.document) {
                    throw new Error('Cannot append pagelet[' + this.id + '] to documentless pagelet[' + pagelet.id + ']');
                } else {
                    this.document = this._getPlaceholder(pagelet.document);
                    this.document.innerHTML = html;
                    var htmlContainer = document.getElementById('pagelethtml_' + this.id);
                    if (htmlContainer) {
                        htmlContainer.parentNode.removeChild(htmlContainer);
                    }
                }
            }
            return this;
        },
        destroy: function() {

        },
        replaceWith: function(id) {

        },
        reload: function() {

        },
        // TODO: 支持事件命名空间，如 click.sign
        on: function(name, handler) {
            if (!this._eventHandlers[name]) {
                this._eventHandlers[name] = [];
            }
            this._eventHandlers[name].push(handler);
            return this;
        },
        off: function(name, handler) {
            if (this._eventHandlers[name]) {
                delete this._eventHandlers[name];
            }
            return this;
        },
        emit: function(name, data) {
            this._excuteCallbacks(this._eventHandlers[name], data);
            if (this.parent) {
                this.parent.emit(name, data);
            }
            return this;
        },
        broadcast: function(name, data) {
            this._excuteCallbacks(this._eventHandlers[name], data);
            if (this.children) {
                for (var childPageletId in this.children) {
                    this.children[childPageletId].broadcast(name, data);
                }
            }
            return this;
        },
        _excuteCallbacks: function(callbacks, data) {
            if (callbacks) {
                //var event = new Event();
                for (var i = callbacks.length - 1; i >= 0; i--) {
                    callbacks[i].call(this, data);
                }
            }
        }
    };

    var __rootPagelet = new Pagelet('__root');
    __rootPagelet.document = document;

    /**
     * @namespace Bigpipe
     */
    var Bigpipe = {};

    Bigpipe.broadcast = function(name, data) {
        __rootPagelet.broadcast(name, data);
    };

    /**
     * @memberof Bigpipe
     * @param {string} id
     * @param {object} options
     * @return {Promise} Promise resolved with a {@link Pagelet} instance
     */
    Bigpipe.register = function(id, options) {
        pagelets[id] = new Pagelet(id, options);
        return new Promise(function(resolve) {
            pagelets[id].promise.then(function() {
                resolve(pagelets[id]);
            });
        });
    };
   Bigpipe.end = function() {
       // 所有 pagelet 完成加载后广播 pageload 事件
       var loadPagelets = [];
       for (var id in pagelets) {
           loadPagelets.push(pagelets[id].promise);
       }
       Promise.all(loadPagelets).then(function() {
           Bigpipe.broadcast('pageload');
       });
   };
    /**
     * 配置
     *
     * @memberof Bigpipe
     * @param {string} id
     * @param {object} options
     */
    Bigpipe.config = function(options) {
        if (typeof options.getHTML === 'function') {
            Pagelet.prototype._getHTML = options.getHTML;
        }
        if (typeof options.getPlaceholder === 'function') {
            Pagelet.prototype._getPlaceholder = options.getPlaceholder;
        }
        if (typeof options.getStylesUrl === 'function') {
            styleManager.config({
                urlsGenerator: options.getStylesUrl
            });
        }
        if (typeof options.getScriptsUrl === 'function') {
            scriptLoader.config({
                urlsGenerator: options.getScriptsUrl
            });
        }
    };

    Bigpipe.debug = function(value) {
        if (value === true) {
            debug = true;
            Bigpipe.Pagelet = Pagelet;
            Bigpipe.pagelets = pagelets;
            Bigpipe.orphanPagelets = orphanPagelets;
            Bigpipe.styleManager = styleManager;
            Bigpipe.scriptLoader = scriptLoader;
        } else {
            debug = false;
            delete Bigpipe.Pagelet;
            delete Bigpipe.pagelets;
            delete Bigpipe.orphanPagelets;
            delete Bigpipe.styleManager;
            delete Bigpipe.scriptLoader;
        }
    };

    var global = this;
    global.Bigpipe = Bigpipe;

}).call(this);
