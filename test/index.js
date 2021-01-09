const http = require('http');
const fs = require('fs');

const axios = require('axios');
const test = require('basictap');

const servatron = require('../');

function createServer (handler) {
  const server = http.createServer(handler);
  server.listen();

  const address = server.address();

  return {
    url: `http://localhost:${address.port}`,
    server
  };
}

test('serve with defaults - file found', async t => {
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

test('serve with defaults - file not found', async t => {
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

test('serves index.html if directory', async t => {
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

test('serves 404 if directory and no index', async t => {
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

test('serve with custom directory - file found', async t => {
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

test('serve with spa mode', async t => {
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
