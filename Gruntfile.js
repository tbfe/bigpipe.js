var url = require('url');

module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    var browsers = [{
        browserName: 'chrome'
    }, {
        browserName: 'chrome',
        version: 'beta'
    }, {
        browserName: 'chrome',
        version: '31'
    }, {
        browserName: 'chrome',
        version: '26'
    }, {
        browserName: 'internet explorer',
        version: '10'
    }, {
        browserName: 'internet explorer',
        version: '11'
    }, {
        browserName: 'firefox'
    }, {
        browserName: 'firefox',
        version: 'beta'
    }, {
        browserName: 'safari',
        platform: 'OS X 10.10'
    }, {
        browserName: 'opera'
    }];

    grunt.initConfig({
        connect: {
            server: {
                options: {
                    base: '',
                    port: 9999,
                    middleware: function(connect, options, middlewares) {
                        // inject a custom middleware into the array of default middlewares
                        middlewares.unshift(function(req, res, next) {
                            var parsedUrl = url.parse(req.url, true);
                            var query = parsedUrl.query;
                            var ttf = query.ttf || 400;
                            setTimeout(next, ttf);
                        });
                        return middlewares;
                    },
                }
            }
        },
        'saucelabs-jasmine': {
            all: {
                options: {
                    urls: ['http://127.0.0.1:9999/test/index.html'],
                    tunnelTimeout: 5,
                    build: process.env.TRAVIS_JOB_ID,
                    concurrency: 3,
                    statusCheckAttempts: 150,
                    browsers: browsers,
                    testname: 'bigpipe.js tests',
                    tags: ['ci', process.env.TRAVIS_BRANCH]
                }
            }
        },
        watch: {
            scripts: {
                files: ['lib/*.js'],
                tasks: ['jsdoc'],
                options: {
                    spawn: false,
                },
            },
        },
        jsdoc: {
            dist: {
                src: ['lib/*.js'],
                options: {
                    destination: 'doc'
                }
            }
        }
    });


    grunt.registerTask('dev', ['connect', 'jsdoc', 'watch']);
    grunt.registerTask('test', ['connect', 'saucelabs-jasmine']);
};
