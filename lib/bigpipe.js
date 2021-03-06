(function () {
    'use strict';

    var debug = false;

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
        for (var i = 0, length = array.length; i < length; i++) {
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


    /**
     * EventManager - 事件管理类
     *
     * @param  {*} context 对象上下文
     * @return {EventManager}
     */
    var EventManager = function (context) {
        this.context = context;
        this._eventPool = {};
    };

    EventManager.prototype = {
        /**
         * addEventListener - 事件绑定
         *
         * @param  {string} eventName 事件名，支持命名空间如：click.sign
         * @param  {function} handler 事件回调
         * @return {EventManager} this
         */
        addEventListener: function (eventName, handler) {
            var eventObj = this._getEventObject(eventName);
            if (!this._eventPool[eventObj.name]) {
                this._eventPool[eventObj.name] = {};
            }
            if (!this._eventPool[eventObj.name][eventObj.namespace]) {
                this._eventPool[eventObj.name][eventObj.namespace] = [];
            }
            this._eventPool[eventObj.name][eventObj.namespace].push(handler);
            return this;
        },

        /**
         * dispatchEvent - 事件触发
         *
         * @param  {string} eventName 事件名，支持命名空间如：click.sign
         * @param  {*} data 回调参数
         * @param  {*} context 回调上下文
         * @return {EventManager} this
         */
        dispatchEvent: function (eventName, data, context) {
            var callbacks = this._getHandlersByEventName(eventName);
            if (callbacks) {
                for (var i = 0, length = callbacks.length; i < length; i++) {
                    callbacks[i].call(context || this.context, data);
                }
            }
        },

        /**
         * removeEventListener - 事件解绑
         *
         * @param  {string} eventName 事件名，支持命名空间如：click.sign
         * @param  {function} handler 事件回调
         * @return {EventManager} this
         */
        removeEventListener: function (eventName, handler) {
            var eventObj = this._getEventObject(eventName);
            if (this._eventPool[eventObj.name] &&
                this._eventPool[eventObj.name][eventObj.namespace]) {
                if (typeof handler === 'function') {
                    var callbacks = this._eventPool[eventObj.name][eventObj.namespace];
                    var targetIndex;
                    while ((targetIndex = callbacks.indexOf(handler)) != -1) {
                        callbacks.splice(targetIndex, 1);
                    }
                } else {
                    delete this._eventPool[eventObj.name][eventObj.namespace];
                }
            }
            return this;
        },

        /**
         * _getEventObject - 获取事件对象
         *
         * @private
         * @param  {string} eventName 事件名，支持命名空间如：click.sign
         * @return {object} 事件对象，包含name和namespace
         */
        _getEventObject: function (eventName) {
            var arr = eventName.split('.');
            // 默认事件池名字是：__default
            return {
                name: arr[0],
                namespace: arr[1] || '__default'
            };
        },

        /**
         * _getHandlersByEventName - 获取回调函数
         *
         * @private
         * @param  {string} eventName 事件名，支持命名空间如：click.sign
         * @return {array} 回调函数数组
         */
        _getHandlersByEventName: function (eventName) {
            var eventObj = this._getEventObject(eventName);
            if (this._eventPool[eventObj.name]) {
                return this._eventPool[eventObj.name][eventObj.namespace];
            } else {
                return [];
            }
        }
    };

    var styleLoader = {
        _loaders: {}
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
        var createLoadStyle = function (url) {
            var loader = styleLoader._loaders[url] || Utils.loadStyle(url);
            styleLoader._loaders[url] = loader;
            loadStyles.push(loader);
        };
        for (var i = 0, length = urls.length; i < length; i++) {
            var url = urls[i];
            createLoadStyle(url);
        }
        return Promise.all(loadStyles);
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
        var createLoadScript = function (url) {
            var loader = scriptLoader._loaders[url] || Utils.loadScript(url);
            scriptLoader._loaders[url] = loader;
            loadScripts.push(loader);
        };
        for (var i = 0, length = urls.length; i < length; i++) {
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
     * 内置资源管理器
     * @param resourceLoader 资源加载器
     * @constructor
     */
    var ResourceManager = function (resourceLoader) {
        var self = this;

        /**
         * 资源加载器
         */
        self.resourceLoader = resourceLoader;

        /**
         * 依赖资源表，未combo
         * @type {Array}
         */
        self.resources = [];

        /**
         * 本地资源表，不依赖外部combo，暂时未使用到，预留给unload机制使用
         * @type {Array}
         */
        self.resourcesLocal = [];

        /**
         * 依赖资源combo结果url，也包含外部依赖的，作为`this.resourceLoader.load`的参数
         * @type {Array}
         */
        self.resourcesComboed = [];
    };

    /**
     * url合并个数上限，超过上限则合并成新的url
     * @type {number}
     */
    ResourceManager.COMBO_SIZE = 25;

    /**
     * 单个资源与combo url的映射表
     * @type {{url: comboUrl}}
     */
    ResourceManager.resourceComboMap = {};

    /**
     * 资源loader池
     * @type {{comboUrl: {count: number, loader: (Promise|*)}}}
     */
    ResourceManager.resourcePool = {};

    /**
     * url合并
     * @param {array} urls
     * @param {number} size
     * @returns {Array}
     */
    ResourceManager.combo = function (urls, size) {
        // 后面对urls进行了splice，这里复制了一次以直接免影响传入值
        urls = urls.concat();
        var comboedUrls = [];
        size = size || ResourceManager.COMBO_SIZE;
        while (urls.length > 0) {
            comboedUrls.push(urls.splice(0, size).join(','));
        }
        return comboedUrls;
    };

    /**
     * 加载资源，返回Promise实例
     * @param ids
     * @returns {Promise}
     */
    ResourceManager.prototype.load = function (ids) {
        this._registerResources(ids);
        if (ids.length > 0) {
            return this.resourceLoader.load(this.resourcesComboed);
        } else {
            return Promise.resolve();
        }
    };

    /**
     * 注册资源，检查是否已合并
     * @param urls
     * @private
     */
    ResourceManager.prototype._registerResources = function (urls) {
        var self = this;
        var resourcesLocal = [];
        // 依赖资源combo结果url
        var resourcesComboed = [];

        // 过滤已combo资源，获取combo url
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

        // combo尚未被combo过的资源
        var resourceCombedNew = ResourceManager.combo(resourcesLocal, ResourceManager.COMBO_SIZE);
        // 遍历本次注册中新combo的资源，构建映射
        Utils.each(resourcesLocal, function (url, i) {
            var part = Math.floor(i / ResourceManager.COMBO_SIZE);
            ResourceManager.resourceComboMap[url] = resourceCombedNew[part];
        });

        // 合并本实例所依赖的外部combo资源和内部新增combo资源
        resourcesComboed = resourcesComboed.concat(resourceCombedNew);

        self.resourcesLocal = self.resourcesLocal.concat(resourcesLocal);
        self.resourcesComboed = self.resourcesComboed.concat(resourcesComboed);
    };

    /**
     * 配置
     * @param {object} options
     */
    ResourceManager.config = function (options) {
        if ( typeof options.COMBO_SIZE === 'number') {
            ResourceManager.COMBO_SIZE = options.COMBO_SIZE;
        }
    };

    var pagelets = {};

    // pagelets who need a parent to appendTo
    // organized by parent id
    var orphanPagelets = {};

    var ROOT_PAGELET_ID = '__root';

    var INITIALIZED = 0;
    var LOADED = 1;
    var OUTDATED = -1;

    var checkTimeStamp = true;

    /**
     * Pagelet
     *
     * @class Pagelet
     * @param  {string} id pageletId
     * @param  {object} options
     * @return {Pagelet} pagelet
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
            // self指向原有实例
            // 此时stae应为OUTDATED
            self = pagelets[id];
            self.serverTimeStamp = options.stamp;

            // 如果这个 pagelet 不为 OUTDATED 状态，检测异常
            if (self.state !== OUTDATED) {
                throw new Error('pagelet[' + id + '] already loaded.');
            }
        } else {
            // 如果 pagelet 不存在
            // self指向新实例
            self = this;

            self.id = id;
            self.children = {};
            self.document = null;
            self.scripts = [];
            self.styles = [];

            // 创建一个事件管理类实例维护本实例的事件
            self.eventManager = new EventManager(this);

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
            self.state = INITIALIZED;
        }

        self.content = options.content;
        self.scripts = Utils.unique(self.scripts.concat(options.scripts || []));
        self.styles = Utils.unique(self.styles.concat(options.styles || []));

        self.scriptResourceManager = new ResourceManager(scriptLoader);
        self.styleResourceManager = new ResourceManager(styleLoader);

        self.promise = self._init();

        // 将实例放入pagelets表
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
                        // 父pagelet尚未ready，则暂不进行挂载
                        if (orphanPagelets[parentId]) {
                            orphanPagelets[parentId].push(this);
                        } else {
                            orphanPagelets[parentId] = [this];
                        }
                    } else {
                        this.mount();
                    }
                    // 外部通过此Bigpipe事件給pagelet绑定事件，注意：this.mount()内会清空pagelet下的所有事件，
                    Bigpipe.dispatchEvent('beforepageletload', this);
                    // tell Bigpipe this pagelet's style is loaded
                    Bigpipe.dispatchEvent('pageletstyleloaded', this);
                }.bind(this));
            }.bind(this));

            return Promise.all([mounter, scriptLoader]).then(function () {
                // tell Bigpipe this pagelet's script is loaded
                Bigpipe.dispatchEvent('pageletscriptloaded', this);
            }.bind(this));
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
            if (this.timeStamp === this.serverTimeStamp || !checkTimeStamp) {
                // 触发所有子 pagelet 析构
                try {
                    this.broadcast('destroy');
                } catch (e) {
                    // 抓住析构中可能的报错
                    console.log(e);
                }
                // 从 pagelets 中移除所有子 pagelet
                Utils.traversePagelet(this, function (pagelet) {
                    delete pagelets[pagelet.id];
                });
                this.children = {};
                // 保留自身实例
                pagelets[this.id] = this;
                // 移除自己身上所有事件，即创建一个新的事件管理类实例
                this.eventManager = new EventManager(this);
            }
            // 下面是正常的挂载逻辑
            this._setParent(this._parentId);
            this._appendTo(this.parent);
            // 处理早于自身ready的子pagelet
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
         * _appendTo - pagelet内容的dom操作
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
                // 清空之前要挂载到pagelet底下的孤儿pagelet
                // 原设计在页面加载完成之后进行一次清空
                // 但是涉及到局刷的时候需要在pagelet树局刷完成后清空，这个时机是无法获取的
                // 所以，在每次刷新pagelet前执行这个操作
                delete orphanPagelets[pagelet.id];
                // 标识本身和所有子pagelet状态为过期
                pagelet.state = OUTDATED;
                // 记录时间戳用于作异步内容时效性校验
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
            url = URI(url)
                .addQuery('pagelets', pageletId)
                .addQuery('pagelets_stamp', timeStamp)
                .toString();

            return new Promise(function (resolve) {
                // 发请求
                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    var results = [];
                    // 将返回内容中的 script 标签的内容提取出来执行
                    var dom = document.createElement('div');
                    dom.innerHTML = xhr.responseText;
                    for (var i = 0, length = dom.childNodes.length; i < length; i++) {
                        var el = dom.childNodes[i];
                        if (el.nodeName !== null && el.nodeName.toUpperCase() === 'SCRIPT' && !el.src) {
                            // eval会返回里面运行的返回值，这里面是一个promise对象
                            /*jslint evil: true */
                            results.push(eval(el.innerHTML));
                            /*jslint evil: false */
                        }
                    }
                    Promise.all(results).then(resolve)['catch'](function (error) {
                        // catch error throw in eval body
                        console.log(error);
                    });
                };
                xhr.open('GET', url, true);
                xhr.send();

            });
        },

        /**
         * on - pagelet事件监听，支持事件命名空间
         *
         * @param  {string} name    事件名，支持命名空间如: `click.sign`
         * @param  {function} handler 事件回调
         * @return {Pagelet}         this
         */
        on: function (name, handler) {
            this.eventManager.addEventListener(name, handler);
            return this;
        },

        /**
         * off - 解除事件绑定
         *
         * @param  {string} name  要解除绑定的事件名，支持命名空间
         * @param  {type} handler description
         * @return {type}         description
         */
        off: function (name, handler) {
            this.eventManager.removeEventListener(name, handler);
            return this;
        },
        /**
         * emit - 向上散发事件
         *
         * @param  {string} name 事件名，支持命名控件如: `click.sign`
         * @param  {*} data 回调参数
         * @return {Pagelet}      this
         */
        emit: function (name, data) {
            this.eventManager.dispatchEvent(name, data);
            if (this.parent) {
                this.parent.emit(name, data);
            }
            return this;
        },
        /**
         * broadcast - 向下广播事件
         *
         * @param  {string} name 事件名，支持命名控件如: `click.sign`
         * @param  {*} data 回调参数
         * @return {Pagelet}      this
         */
        broadcast: function (name, data) {
            this.eventManager.dispatchEvent(name, data);
            if (this.children) {
                for (var childPageletId in this.children) {
                    this.children[childPageletId].broadcast(name, data);
                }
            }
            return this;
        }
    };

    var __rootPagelet = new Pagelet(ROOT_PAGELET_ID);
    __rootPagelet.document = document;

    /**
     * @namespace Bigpipe
     */
    var Bigpipe = {};

    /**
     * Bigpipe事件池
     * @type {EventManager}
     * @private
     */
    var _bigpipeEventManager = new EventManager(Bigpipe);

    /**
     * 向所有pagelet广播事件
     * @param name
     * @param data
     */
    Bigpipe.broadcast = function (name, data) {
        __rootPagelet.broadcast(name, data);
        return this;
    };

    /**
     * 在Bigpipe下绑定事件
     * @param name
     * @param handler
     * @returns {Bigpipe}
     */
    Bigpipe.addEventListener = function (name, handler) {
        _bigpipeEventManager.addEventListener(name, handler);
        return this;
    };

    /**
     * 移除Bigpipe下事件
     * @param name
     * @param handler
     * @returns {Bigpipe}
     */
    Bigpipe.removeEventListener = function (name, handler) {
        _bigpipeEventManager.removeEventListener(name, handler);
        return this;
    };

    /**
     * 分发Bigpipe事件
     * @param name
     * @param data
     */
    Bigpipe.dispatchEvent = function (name, data) {
        _bigpipeEventManager.dispatchEvent(name, data);
        return this;
    };

    /**
     * @memberof Bigpipe
     * @param {string} id
     * @param {object} options
     * @return {Promise} Promise resolved with a {@link Pagelet} instance
     */
    Bigpipe.register = function (id, options) {
        try {
            var pagelet = new Pagelet(id, options);
            return pagelet.promise.then(function () {
                return pagelet;
            });
        } catch (error) {
            console.warn(error);
            throw error;
        }
    };
    Bigpipe.end = function () {
        // 所有 pagelet 完成加载后广播 pageload 事件
        var loadPagelets = [];
        for (var id in pagelets) {
            loadPagelets.push(pagelets[id].promise);
        }
        Promise.all(loadPagelets).then(function () {
            // tell Bigpipe that the page is loaded
            Bigpipe.dispatchEvent('pageloaded', pagelets);
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
        // 资源管理器可通过外部配置
        if (typeof options.ResourceManager === 'function') {
            ResourceManager = options.ResourceManager;
        }
        // 是否在refresh时进行时间戳校验，用于测试等特殊场景
        if (options.ignoreTimeStamp === true) {
            checkTimeStamp = false;
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
            Bigpipe.ResourceManager = ResourceManager;
            Bigpipe.Utils = Utils;
            Bigpipe._bigpipeEventManager = _bigpipeEventManager;
        } else {
            debug = false;
            delete Bigpipe.Pagelet;
            delete Bigpipe.pagelets;
            delete Bigpipe.orphanPagelets;
            delete Bigpipe.styleLoader;
            delete Bigpipe.scriptLoader;
            delete Bigpipe.ResourceManager;
            delete Bigpipe.Utils;
            delete Bigpipe._eventHandlers;
        }
    };

    var global = this;
    global.Bigpipe = Bigpipe;

}).call(this);
