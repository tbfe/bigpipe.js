#!/usr/bin/env sh
if [ "${TRAVIS_PULL_REQUEST}" = "false" ] && [ "${TRAVIS_BRANCH}" = "master" ]
then (
    echo "Deploy docs to github pages."
    grunt jsdoc
    cd doc
    git init
    git config user.name "tbfe"
    git config user.email "tbfe-ci@baidu.com"
    git add .
    git commit -m "Deploy document to Github Pages [skip ci]"
    git push --force --quiet "https://${GH_TOKEN}@${GH_REF}" master:gh-pages
)
else
    echo "This push is not on master, skip deploying docs."
fi
