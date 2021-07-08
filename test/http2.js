const http2 = require('http2');
const fs = require('fs');

const { context } = require('fetch-h2');
const test = require('basictap');

const servatron = require('../lib/http2').default;

const { fetch, disconnectAll } = context({
  session: { rejectUnauthorized: false }
});

function createServer (handler) {
  const server = http2.createSecureServer({
    key: fs.readFileSync('./defaultCerts/key.pem'),
    cert: fs.readFileSync('./defaultCerts/cert.pem')
  });

  server.on('error', (error) => console.error(error));

  server.on('stream', handler);

  server.listen(8280);

  return {
    url: 'https://localhost:8280',
    server
  };
}

test('http2 - can not access parent directory', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/../package.json`, {
    session: {
      rejectUnauthorized: false
    }
  });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - serve with defaults - file found', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/package.json`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync('./package.json', 'utf8'), 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'application/json', 'should have the correct content-type header');
});

test('http2 - serve with defaults - file not found', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/not-found.json`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - serves index.html if directory', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/test/exampleWithIndex`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});

test('http2 - serves 404 if directory and no index', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/test`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - serve with custom directory - file found', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/exampleWithIndex`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});

test('http2 - serve with spa mode', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    spa: true
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/not-found`, {
    session: { rejectUnauthorized: false }
  });

  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});
