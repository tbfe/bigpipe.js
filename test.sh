#!/bin/bash
node test/serve & SERVER_PID=$!;
phantomjs test/runner.js test/index.html;
result=$?;
kill $SERVER_PID;
exit $result;
