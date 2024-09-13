import http2 from 'http2';
import fs from 'fs';
import { context } from 'fetch-h2';
import test from 'basictap';
import servatron from '../http2';

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
  t.plan(4);

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
  t.equal(response.headers.get('access-control-allow-origin'), null, 'should have the correct cors header');
});

test('http2 - sets cors correctly', async t => {
  t.plan(4);

  const handler = servatron({
    directory: 'test',
    antiCors: true
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
  t.equal(response.headers.get('access-control-allow-origin'), '*', 'should have the correct cors header');
});

test('http2 - sets cors specifically on origin', async t => {
  t.plan(1);

  const handler = servatron({
    directory: 'test',
    antiCors: true
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/../package.json`, {
    allowForbiddenHeaders: true,
    headers: {
      Origin: 'example.com'
    },
    session: {
      rejectUnauthorized: false
    }
  });

  server.close();
  disconnectAll();

  t.equal(response.headers.get('access-control-allow-origin'), 'example.com', 'should have the correct cors header');
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

test('http2 - double encoded URL should result in 404', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const doubleEncodedURL = encodeURIComponent(encodeURIComponent('/../package.json'));
  const response = await fetch(`${url}/${doubleEncodedURL}`, { session: { rejectUnauthorized: false } });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should return 404 for double encoded URLs');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - encoded URL traversal outside directory should result in 404', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const encodedTraversalURL = encodeURIComponent('/../package.json');
  const response = await fetch(`${url}/${encodedTraversalURL}`, { session: { rejectUnauthorized: false } });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should return 404 for encoded path traversal attempts');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - valid encoded URL should serve file', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const fileName = 'some file.txt';
  const encodedFileName = encodeURIComponent(fileName);
  const validEncodedURL = `/exampleWithIndex/${encodedFileName}`;
  const response = await fetch(`${url}${validEncodedURL}`, { session: { rejectUnauthorized: false } });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync(`./test/exampleWithIndex/${fileName}`, 'utf8'), 'should serve the correctly encoded file');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - URL containing percent sign not part of encoding should result in 404', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const invalidURL = '/some%file.txt';
  const response = await fetch(`${url}/${invalidURL}`, { session: { rejectUnauthorized: false } });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 404);
  t.equal(responseData, '404 - not found', 'should return 404 for URLs with isolated percent signs');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});
