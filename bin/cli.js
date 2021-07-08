#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const http = require('http');
const http2 = require('http2');
const minimist = require('minimist');

const servatron = require('../lib/http').default;
const servatronHttp2 = require('../lib/http2').default;

const argv = minimist(process.argv);

const bindHost = argv.b || argv.bind || '0.0.0.0';
const port = argv.p || argv.port || 8000;
const directory = argv.d || argv.directory;
const spa = argv.s || argv.spa;
const spaIndex = argv.i || argv.spaIndex;
const isHttp2 = argv.http2;
const key = argv.key || path.resolve(__dirname, '../defaultCerts/key.pem');
const cert = argv.cert || path.resolve(__dirname, '../defaultCerts/cert.pem');
const ca = argv.ca;

function main () {
  const handler = servatron({
    directory,
    spa,
    spaIndex
  });

  const server = http.createServer(handler);

  server.on('listening', function () {
    const address = server.address();
    console.log('Web server running:', `http://${bindHost}:${address.port}`);
  });

  server.listen(port, bindHost);
}

function mainHttp2 () {
  const handler = servatronHttp2({
    directory,
    spa,
    spaIndex
  });

  const server = http2.createSecureServer({
    key: fs.readFileSync(key),
    cert: fs.readFileSync(cert),
    ca: ca && fs.readFileSync(ca)
  });
  server.on('error', (error) => console.error(error));

  server.on('stream', handler);

  server.on('listening', function () {
    const address = server.address();
    console.log('Web server running:', `https://${bindHost}:${address.port}`);
  });

  server.listen(port, bindHost);
}

if (isHttp2) {
  mainHttp2();
} else {
  main();
}
