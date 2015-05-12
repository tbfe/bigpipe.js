(function () {
    'use strict';

    var debug = false;

    var needCombo = true;

    var Utils = {};

    Utils.loadScript = function (url) {
        return new Promise(function (resolve) {
            var script = document.createElement('script');
            script.src = url;
            script.onload = function () {
                if (debug) {
                    console.log('script [' + url + '] loaded');
                }
                resolve();
            };
            var head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(script);
        });
    };

    Utils.loadStyle = function (url) {
        return new Promise(function (resolve) {
            var stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = url;
            stylesheet.onload = function () {
                if (debug) {
                    console.log('stylesheet [' + url + '] loaded');
                }
                resolve();
            };
            var head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(stylesheet);
        });
    };

    Utils.combo = function (urls, size) {
        // todo urls过多时分成多个combo
        return [urls.join(',')];
    }

    // TODO: 这里需要替换成更合适的 uri mutation 库
    Utils.Uri = function (uri) {
        this.uri = uri;
    };
    Utils.Uri.prototype.addParam = function (key, value) {
        var separator = this.uri.indexOf('?') > -1 ? '&' : '?';
        this.uri += separator + encodeURIComponent(key) + '=' + encodeURIComponent(value);
        return this;
    };
    Utils.Uri.prototype.toString = function () {
        return this.uri;
    };

    Utils.traversePagelet = function (pagelet, fun) {
        fun(pagelet);
        for (var childPageletKey in pagelet.children) {
            Utils.traversePagelet(pagelet.children[childPageletKey], fun);
        }
    };

    // 这里 unique 只需要满足 String 类型的数组元素即可
    // 所以采用了 hashmap 去重
    Utils.unique = function (array) {
        if (!(array instanceof Array)) {
            throw new TypeError(array + ' is not an array');
        }
        var result = [];
        var hashmap = {};
        for (var i = 0, len = array.length; i < len; i++) {
            var item = array[i];
            if (typeof item !== 'string') {
                throw new TypeError('array item ' + item + ' is not a string');
            }
            if (!hashmap[item]) {
                result.push(item);
                hashmap[item] = true;
            }
        }
        return result;
    };

    Utils.filter = function (array, func) {
        var result = [];
        for (var i = 0, length = array.length; i < length; i++) {
            var item = array[i];
            if (func(item, i)) {
                result.push(item);
            }
        }
        return result;
    };

    Utils.each = function (array, func) {
        for (var i = 0, length = array.length; i < length; i++) {
            var item = array[i];
            func(item, i);
        }
        return array;
    };

    var styleLoader = {
        _styles: {}
    };

    styleLoader._getUrl = function (ids) {
        return ids;
    };

    styleLoader.load = function (ids) {
        if (!(ids instanceof Array)) {
            ids = [ids];
        }
        var urls = this._getUrl(ids);
        var loadStyles = [];
        var length = urls.length;
        var createLoadStyle = function (url) {
            var style = styleLoader._styles[url];
            var loadStyle = new Promise(function (resolve) {
                if (style) {
                    style.count++;
                    style.loader.then(resolve);
                } else {
                    var stylesheet = document.createElement('link');
                    stylesheet.rel = 'stylesheet';
                    stylesheet.href = url;
                    stylesheet.onload = function () {
                        if (debug) {
                            console.log('style [' + url + '] loaded');
                        }
                        resolve();
                    };
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.appendChild(stylesheet);
                    // styleLoader 这里需要拿到 stylesheet 的引用
                    // 所以暂时没有抽出一个 Utils.loadStyle 方法
                    styleLoader._styles[url] = {
                        element: stylesheet,
                        count: 1
                    };
                }
            });
            if (!style) {
                styleLoader._styles[url].loader = loadStyle;
            }
            loadStyles.push(loadStyle);
        };
        for (var i = 0; i < length; i++) {
            var url = urls[i];
            createLoadStyle(url);
        }
        return Promise.all(loadStyles);
    };
    styleLoader.unload = function (ids) {
        if (!(ids instanceof Array)) {
            ids = [ids];
        }
        var urls = this._getUrl(ids);
        for (var i = urls.length - 1; i >= 0; i--) {
            var url = urls[i];
            var style = styleLoader._styles[url];
            if (style) {
                style.count--;
                if (style.count === 0) {
                    var head = document.head || document.getElementsByTagName('head')[0];
                    head.removeChild(style.element);
                    delete style.element;
                    delete styleLoader._styles[url];
                    if (debug) {
                        console.log('style [' + url + '] unloaded');
                    }
                }
            }
        }
        return Promise.resolve();
    };
    styleLoader.config = function (options) {
        if (typeof options !== 'object') {
            return;
        }
        if (typeof options.urlsGenerator === 'function') {
            styleLoader._getUrl = options.urlsGenerator;
        }
    };

    var scriptLoader = {
        _loaders: {}
    };
    scriptLoader._getUrl = function (ids) {
        return ids;
    };
    scriptLoader.load = function (ids) {
        if (!(ids instanceof Array)) {
            ids = [ids];
        }
        var urls = this._getUrl(ids);
        var loadScripts = [];
        var length = urls.length;
        var createLoadScript = function (url) {
            var loadScript = new Promise(function (resolve) {
                var loader = scriptLoader._loaders[url];
                if (loader) {
                    loader.then(resolve);
                } else {
                    Utils.loadScript(url).then(resolve);
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
    scriptLoader.config = function (options) {
        if (typeof options !== 'object') {
            return;
        }
        if (typeof options.urlsGenerator === 'function') {
            scriptLoader._getUrl = options.urlsGenerator;
        }
    };


    /**
     * 资源管理器
     * @param id pagelet id
     * @param {array} scripts 脚本依赖
     * @param {array} styles 样式依赖
     * @constructor
     */
    function ResourceManager (resourceLoader) {
        var self = this;

        self.resourceLoader = resourceLoader;

        // 资源依赖表
        self.resources = [];

        // 本地资源表，不依赖外部combo
        self.resourcesLocal = [];

        // combo结果url
        self.resourcesComboed = [];

    }

    /**
     * 资源与combo映射表
     * @type {{url: comboUrl}}
     */
    ResourceManager.resourceComboMap = {};

    /**
     * 资源loader池
     * @type {{comboUrl: {count: number, loader: (Promise|*)}}}
     */
    ResourceManager.resourcePool = {};

    ResourceManager.prototype.load = function (ids) {
        this.registerResources(ids);
        if (ids.length > 0) {
            return this.resourceLoader.load(this.resourcesComboed);
        } else {
            return Promise.resolve();
        }
    };

    ResourceManager.prototype.registerResources = function (urls) {
        var self = this;
        var resourcesLocal = [];
        // 已被其他pagelet combo的url
        var resourcesComboed = [];

        // 检查已combo url，过滤
        resourcesLocal = Utils.filter(urls, function (url) {
            var urlCombed = ResourceManager.resourceComboMap[url];
            if (urlCombed) {
                if (resourcesComboed.indexOf(urlCombed) === -1) {
                    resourcesComboed.push(urlCombed);
                }
                return false;
            } else {
                return true;
            }
        });

        // 处理待combo url
        var SIZE = 20;  // todo 待提出作配置项
        var resourceCombedTemp = Utils.combo(resourcesLocal, SIZE);
        resourcesComboed = resourcesComboed.concat(resourceCombedTemp);
        Utils.each(resourcesLocal, function (url, i) {
            var part = Math.floor(i / SIZE);
            ResourceManager.resourceComboMap[url] = resourceCombedTemp[part];
        });

        self.resourcesLocal = resourcesLocal;
        self.resourcesComboed = resourcesComboed;
    };

    var pagelets = {};
    //pagelets who need a parent to appendTo
    //organized by parent id
    var orphanPagelets = {};

    var INITIALIZED = 0;
    var LOADED = 1;
    var OUTDATED = -1;

    var ROOT_PAGELET_ID = '__root';

    /**
     * Pagelet
     *
     * @class Pagelet
     * @param  {string} id
     * @param  {object} options description
     */
    function Pagelet(id, options) {
        if (typeof id !== 'string') {
            throw new TypeError('pagelet id must be a String.');
        }
        if (typeof options !== 'object') {
            options = {};
        }
        var self;
        if (pagelets[id]) {
            // 如果 pagelet 已存在
            self = pagelets[id];
            if (self.state !== OUTDATED) {
                // 如果这个 pagelet 不为 OUTDATED 状态，报异常
                throw new Error('pagelet[' + id + '] already loaded.');
            } else {

            }
        } else {
            //
            self = this;

            self.id = id;
            self.children = {};
            self.document = null;
            self._eventHandlers = {};

            self.scripts = [];
            self.styles = [];

            if (id === ROOT_PAGELET_ID) {
                self.state = LOADED;
                pagelets[id] = self;
                return;
            }

            var parentId = options.parent;
            if (!parentId) {
                parentId = ROOT_PAGELET_ID;
            }
            self._parentId = parentId;

        }

        /**
         * @public
         * @type string
         */
        self.content = options.content;
        self.scripts = Utils.unique(self.scripts.concat(options.scripts || []));
        self.styles = Utils.unique(self.styles.concat(options.styles || []));

        self.scriptResourceManager = new ResourceManager(scriptLoader);
        self.styleResourceManager = new ResourceManager(styleLoader);

        self.state = INITIALIZED;

        self.promise = self._init();

        pagelets[id] = self;

        return self;
    }

    Pagelet.prototype = {
        _init: function () {
            var styleLoader = this.styleResourceManager.load(this.styles);
            var scriptLoader = this.scriptResourceManager.load(this.scripts);

            var mounter = new Promise(function (resolve) {
                this.resolveMounter = resolve;
                styleLoader.then(function () {
                    var parentId = this._parentId;
                    if (!(pagelets[parentId] && pagelets[parentId].state >= LOADED)) {
                        // parent not ready yet
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
        _setParent: function (id) {
            this.parent = pagelets[id];
            this.parent.children[this.id] = this;
            return this;
        },
        _getPlaceholder: function (document) {
            if (!document.getElementById) {
                document = window.document;
            }
            return document.getElementById('pagelet_' + this.id);
        },
        _getHTML: function () {
            if (typeof this.content !== 'undefined') {
                return this.content;
            }
            var htmlContainer = document.getElementById('pagelet_html_' + this.id);
            if (!htmlContainer) {
                return false;
            }
            var result = htmlContainer.innerHTML.trim().match(/^<!--([\s\S]*)-->$/);
            if (result) {
                return result[1];
            } else {
                return '';
            }
        },
        /**
         * mount - 挂载 pagelet
         *
         * @return {Pagelet}  self
         */

        mount: function () {
            // 当这次 mount 是在更新一个过时 pagelet 且时间戳 match
            if (1) {
                // 触发所有子 pagelet 析构
                this.broadcast('destroy');
                // 从 pagelets 中移除所有子 pagelet
                Utils.traversePagelet(this, function (pagelet) {
                    delete pagelets[pagelet.id];
                });
                this.children = {};
                // 自己还是要保留的
                pagelets[this.id] = this;
                // 移除自己身上所有事件
                this._eventHandlers = {};
            }
            // 下面是正常的挂载逻辑
            this._setParent(this._parentId);
            this._appendTo(this.parent);
            if (orphanPagelets[this.id]) {
                var childrenPagelets = orphanPagelets[this.id];
                for (var i = childrenPagelets.length - 1; i >= 0; i--) {
                    childrenPagelets[i].mount();
                }
            }
            this.state = LOADED;
            delete this.timeStamp;
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
        _appendTo: function (pagelet) {
            if (!(pagelet instanceof Pagelet)) {
                throw new TypeError(pagelet + 'is not a pagelet.');
            }
            if (this.state >= LOADED) {
                throw new Error('pagelet[' + this.id + '] is already mounted');
            }
            var html = this._getHTML();
            if (html !== false) {
                if (!pagelet.document) {
                    throw new Error('Cannot append pagelet[' + this.id + '] to documentless pagelet[' + pagelet.id + ']');
                } else {
                    this.document = this._getPlaceholder(pagelet.document);
                    if (!this.document) {
                        throw new Error('Cannot find the placeholder for pagelet[' + this.id + ']');
                    }
                    this.document.innerHTML = html;
                    var htmlContainer = document.getElementById('pagelet_html_' + this.id);
                    if (htmlContainer) {
                        htmlContainer.parentNode.removeChild(htmlContainer);
                    }
                }
            }
            return this;
        },
        remove: function () {
            this.broadcast('destroy');
            this.document.innerHTML = '';
        },
        replaceWith: function (id, options) {

        },
        refresh: function (options) {
            if (typeof options !== 'object') {
                options = {};
            }

            this.broadcast('beforerefresh');

            var timeStamp = new Date().getTime();

            Utils.traversePagelet(this, function (pagelet) {
                pagelet.state = OUTDATED;
                pagelet.timeStamp = timeStamp;
            });

            var url;
            if (typeof options.url === 'string') {
                url = options.url;
            } else if (typeof options.url === 'function') {
                url = options.url(window.location.href);
            } else {
                url = window.location.href;
            }
            // 增加参数，得到单独渲染 pagelet 的 url
            var pageletId = this.id;
            url = new Utils.Uri(url)
                .addParam('pagelets', pageletId)
                .addParam('pagelets_stamp', timeStamp)
                .toString();

            return new Promise(function (resolve) {
                // 发请求
                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    var results = [];
                    // 将返回内容中的 script 标签的内容提取出来执行
                    var dom = document.createElement('div');
                    dom.innerHTML = xhr.responseText;
                    for (var i = 0, len = dom.childNodes.length; i < len; i++) {
                        var el = dom.childNodes[i];
                        if (el.nodeName !== null && el.nodeName.toUpperCase() === 'SCRIPT' && !el.src) {
                            /*jslint evil: true */
                            results.push(eval(el.innerHTML));
                            /*jslint evil: false */
                        }
                    }
                    Promise.all(results).then(function () {
                        resolve();
                    });
                };
                xhr.open('GET', url, true);
                xhr.send();

            });
        },
        // TODO: 支持事件命名空间，如 click.sign
        on: function (name, handler) {
            if (!this._eventHandlers[name]) {
                this._eventHandlers[name] = [];
            }
            this._eventHandlers[name].push(handler);
            return this;
        },
        // TODO: 移除特定 handler，移除全部事件
        off: function (name, handler) {
            if (this._eventHandlers[name]) {
                delete this._eventHandlers[name];
            }
            return this;
        },
        emit: function (name, data) {
            this._excuteCallbacks(this._eventHandlers[name], data);
            if (this.parent) {
                this.parent.emit(name, data);
            }
            return this;
        },
        broadcast: function (name, data) {
            this._excuteCallbacks(this._eventHandlers[name], data);
            if (this.children) {
                for (var childPageletId in this.children) {
                    this.children[childPageletId].broadcast(name, data);
                }
            }
            return this;
        },
        _excuteCallbacks: function (callbacks, data) {
            if (callbacks) {
                //var event = new Event();
                for (var i = callbacks.length - 1; i >= 0; i--) {
                    callbacks[i].call(this, data);
                }
            }
        }
    };

    var __rootPagelet = new Pagelet(ROOT_PAGELET_ID);
    __rootPagelet.document = document;

    /**
     * @namespace Bigpipe
     */
    var Bigpipe = {};

    Bigpipe.broadcast = function (name, data) {
        __rootPagelet.broadcast(name, data);
    };

    /**
     * @memberof Bigpipe
     * @param {string} id
     * @param {object} options
     * @return {Promise} Promise resolved with a {@link Pagelet} instance
     */
    Bigpipe.register = function (id, options) {
        var pagelet = new Pagelet(id, options);
        return new Promise(function (resolve) {
            pagelet.promise.then(function () {
                resolve(pagelet);
            });
        });
    };
    Bigpipe.end = function () {
        // 所有 pagelet 完成加载后广播 pageload 事件
        var loadPagelets = [];
        for (var id in pagelets) {
            loadPagelets.push(pagelets[id].promise);
        }
        Promise.all(loadPagelets).then(function () {
            Bigpipe.broadcast('pageload');
            // TODO: cleanupOrphanPagelets();
            // 刷新、加载页面部分 pagelets 时可能会留下无用的 orphanPagelets
        });
    };
    /**
     * 配置
     *
     * @memberof Bigpipe
     * @param {string} id
     * @param {object} options
     */
    Bigpipe.config = function (options) {
        if (typeof options.getHTML === 'function') {
            Pagelet.prototype._getHTML = options.getHTML;
        }
        if (typeof options.getPlaceholder === 'function') {
            Pagelet.prototype._getPlaceholder = options.getPlaceholder;
        }
        if (typeof options.getStylesUrl === 'function') {
            styleLoader.config({
                urlsGenerator: options.getStylesUrl
            });
        }
        if (typeof options.getScriptsUrl === 'function') {
            scriptLoader.config({
                urlsGenerator: options.getScriptsUrl
            });
        }
    };

    Bigpipe.debug = function (value) {
        if (value === true) {
            debug = true;
            Bigpipe.Pagelet = Pagelet;
            Bigpipe.pagelets = pagelets;
            Bigpipe.orphanPagelets = orphanPagelets;
            Bigpipe.styleLoader = styleLoader;
            Bigpipe.scriptLoader = scriptLoader;
            Bigpipe.Utils = Utils;
        } else {
            debug = false;
            delete Bigpipe.Pagelet;
            delete Bigpipe.pagelets;
            delete Bigpipe.orphanPagelets;
            delete Bigpipe.styleLoader;
            delete Bigpipe.scriptLoader;
            delete Bigpipe.Utils;
        }
    };

    Bigpipe.needCombo = function (value) {
        if (value === true) {
            needCombo = true;
        } else {
            needCombo = false;
        }
    }

    var global = this;
    global.Bigpipe = Bigpipe;

}).call(this);
