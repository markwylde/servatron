#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const http = require('http');
const http2 = require('http2');
const minimist = require('minimist');
const packageJson = require('../package.json');

const servatron = require('../http');
const servatronHttp2 = require('../http2');

const argv = minimist(process.argv);

const bindHost = argv.b || argv.bind || '0.0.0.0';
const port = argv.p || argv.port || 8000;
const directory = argv.d || argv.directory;
const spa = argv.s || argv.spa;
const spaIndex = argv.i || argv['spa-index'];
const antiCors = argv['anti-cors'];
const isHttp2 = argv.http2;
const key = argv.key || path.resolve(__dirname, '../defaultCerts/key.pem');
const cert = argv.cert || path.resolve(__dirname, '../defaultCerts/cert.pem');
const ca = argv.ca;

function main () {
  const handler = servatron({
    directory,
    spa,
    spaIndex,
    antiCors
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
    spaIndex,
    antiCors
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

if (argv.help || argv._[2] === 'help') {
  console.log([
    `${packageJson.name} cli - v${packageJson.version}`,
    '',
    'Example usage:',
    '  servatron --directory dist --port 8000 --spa',
    '',
    'Options:',
    '  --directory (-d) pathName      specify a directory to server the files from (can provider multiple)',
    '  --bind (-b) hostname           what host to bind on (default: 0.0.0.0)',
    '  --port (-p) number             what port to listen on (default: 8000)',
    '  --spa                          when a path is not found, deliver the index file',
    '  --spa-index                    what name spa mode should look for the html file (default: index.html)',
    '  --http2                        use http2 as the server protocol',
    '  --key                          what key to use for http2',
    '  --cert                         what cert to use for http2',
    '  --ca                           optionally add a ca for http2',
    '  --anti-cors                    set all CORS headers to the most flexible'
  ].join('\n'));
} else if (isHttp2) {
  mainHttp2();
} else {
  main();
}
