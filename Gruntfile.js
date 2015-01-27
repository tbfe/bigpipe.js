module.exports = function(grunt) {
	require('load-grunt-tasks')(grunt);

	var browsers = [{
		browserName: "firefox",
		platform: "XP"
	}, {
		browserName: "chrome",
		platform: "XP"
	}, {
		browserName: "chrome",
		platform: "XP",
		version: "30"
	}, {
		browserName: "internet explorer",
		platform: "XP",
		version: "8"
	}, {
		browserName: "internet explorer",
		platform: "WIN7",
		version: "9"
	}, {
		browserName: "internet explorer",
		platform: "WIN8",
		version: "11"
	}, {
		browserName: "internet explorer",
		platform: "WIN8",
		version: "11"
	}];

	grunt.initConfig({
		connect: {
			server: {
				options: {
					base: "",
					port: 9999
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
					tags: ["master"]
				}
			}
		},
		watch: {}
	});


	grunt.registerTask("dev", ["connect", "watch"]);
	grunt.registerTask("test", ["connect", "saucelabs-jasmine"]);
};
