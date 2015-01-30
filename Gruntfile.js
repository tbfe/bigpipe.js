module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    var browsers = [{
        browserName: "chrome",
        platform: "XP"
    }, {
        browserName: "chrome",
        platform: "XP",
        version: "30"
    }, {
        browserName: "chrome",
        platform: "OS X 10.10"
    }, {
        browserName: "internet explorer",
        platform: "WIN7",
        version: "9"
    }, {
        browserName: "internet explorer",
        version: "10"
    }, {
        browserName: "internet explorer",
        version: "11"
    }, {
        browserName: "firefox"
    }, {
        browserName: "safari",
        platform: "OS X 10.10"
    }, {
        browserName: "iphone",
        version: "8.1"
    }, {
        browserName: "android",
        version: "4.4"
    }];

    grunt.initConfig({
        connect: {
            server: {
                options: {
                    base: "",
                    port: 9999,
                    middleware: function(connect, options, middlewares) {
                        // inject a custom middleware into the array of default middlewares
                        middlewares.unshift(function(req, res, next) {
                            setTimeout(next, 400);
                        });
                        return middlewares;
                    },
                }
            }
        },
        'saucelabs-jasmine': {
            all: {
                options: {
                    urls: ["http://127.0.0.1:9999/test/index.html"],
                    tunnelTimeout: 5,
                    build: process.env.TRAVIS_JOB_ID,
                    concurrency: 3,
                    browsers: browsers,
                    testname: "bigpipe.js tests",
                    tags: ["ci", "master"]
                }
            }
        },
        watch: {}
    });


    grunt.registerTask("dev", ["connect", "watch"]);
    grunt.registerTask("test", ["connect", "saucelabs-jasmine"]);
};
