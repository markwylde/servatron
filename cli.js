#!/usr/bin/env node

const http = require('http');
const minimist = require('minimist');

const servatron = require('./');

const argv = minimist(process.argv);

const port = argv.p || argv.port || 8000;
const directory = argv.d || argv.directory;
const spa = argv.s || argv.spa;

function main () {
  const handler = servatron({
    directory,
    spa
  });

  const server = http.createServer(handler);

  server.on('listening', function () {
    const address = server.address();
    console.log('Web server running:', `http://localhost:${address.port}`);
  });

  server.listen(port);
}

main();
