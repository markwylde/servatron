import http from 'http';
import fs from 'fs';

import axios from 'axios';
import test from 'basictap';

const servatron = require('../http');

function createServer (handler) {
  const server = http.createServer(handler);
  server.listen();

  const address = server.address();

  return {
    url: `http://localhost:${address.port}`,
    server
  };
}

test('http - can not access parent directory', async t => {
  t.plan(4);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/../package.json`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
  t.equal(response.headers['access-control-allow-origin'], undefined, 'should not have the cors header set');
});

test('http - sets cors correctly', async t => {
  t.plan(4);

  const handler = servatron({
    directory: 'test',
    antiCors: true
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/../package.json`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
  t.equal(response.headers['access-control-allow-origin'], '*', 'should have the cors header set');
});

test('http - sets cors specifically on origin', async t => {
  t.plan(1);

  const handler = servatron({
    directory: 'test',
    antiCors: true
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/../package.json`, {
    transformResponse: [],
    validateStatus: () => true,
    headers: {
      Origin: 'example.com'
    }
  });

  server.close();

  t.equal(response.headers['access-control-allow-origin'], 'example.com', 'should have the cors header set');
});

test('http - serve with defaults - file found', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/package.json`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync('./package.json', 'utf8'), 'should have the correct body');
  t.equal(response.headers['content-type'], 'application/json', 'should have the correct content-type header');
});

test('http - serve with defaults - file not found', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/not-found.json`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - serves index.html if directory', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/test/exampleWithIndex`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - serves 404 if directory and no index', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/test`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - serve with custom directory - file found', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/exampleWithIndex`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - serve with spa mode', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    spa: true
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/not-found`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync('./test/exampleWithIndex/index.html', 'utf8'), 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - double encoded URL should result in 404', async t => {
  t.plan(3);

  const handler = servatron();
  const { server, url } = createServer(handler);

  const doubleEncodedURL = encodeURIComponent(encodeURIComponent('/../package.json'));
  const response = await axios(`${url}/${doubleEncodedURL}`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should return 404 for double encoded URLs');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - encoded URL traversal outside directory should result in 404', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const encodedTraversalURL = encodeURIComponent('/../package.json');
  const response = await axios(`${url}/${encodedTraversalURL}`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should return 404 for encoded path traversal attempts');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - valid encoded URL should serve file', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  // Encode only the filename, not the entire path
  const fileName = 'some file.txt';
  const encodedFileName = encodeURIComponent(fileName);
  const validEncodedURL = `/exampleWithIndex/${encodedFileName}`;
  console.log(`${url}${validEncodedURL}`);
  const response = await axios(`${url}${validEncodedURL}`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync(`./test/exampleWithIndex/${fileName}`, 'utf8'), 'should serve the correctly encoded file');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - URL containing percent sign not part of encoding should result in 404', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test'
  });
  const { server, url } = createServer(handler);

  const invalidURL = '/some%file.txt';
  const response = await axios(`${url}/${invalidURL}`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  t.equal(response.status, 404);
  t.equal(response.data, '404 - not found', 'should return 404 for URLs with isolated percent signs');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});
