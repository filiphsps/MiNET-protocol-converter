#!/usr/bin/env node

var lib = require('../index.js');
lib(() => {
    console.log('Generated output.json!');
});
