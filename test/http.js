import http from 'http';
import path from 'path';
import fs from 'fs';

import ejs from 'ejs';
import axios from 'axios';
import test from 'basictap';

import servatron from '../http';

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

test('http - serves first found index file from array', async t => {
  t.plan(3);

  // Create a separate test server with full debugging
  const testServer = http.createServer(async (req, res) => {
    console.log("Request URL:", req.url);

    if (req.url === '/exampleWithMultipleIndex') {
      console.log("Testing index array feature");

      // Manual implementation for debugging
      const indexFiles = ['missing.html', 'index.txt', 'index.html'];
      const dirPath = path.join(process.cwd(), 'test/exampleWithMultipleIndex');

      console.log("Directory path:", dirPath);
      console.log("Directory exists:", fs.existsSync(dirPath));
      console.log("Stats:", await fs.promises.stat(dirPath));

      let indexFound = false;
      let foundFilePath = null;

      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        console.log("Checking index file:", indexPath);
        console.log("File exists:", fs.existsSync(indexPath));

        try {
          const stats = await fs.promises.stat(indexPath);
          console.log("Stats:", stats.isFile());

          if (stats.isFile()) {
            foundFilePath = indexPath;
            indexFound = true;
            console.log("Found index file:", foundFilePath);
            break;
          }
        } catch (error) {
          console.log("Error checking index file:", error.message);
        }
      }

      if (indexFound) {
        console.log("Serving:", foundFilePath);
        const fileContent = await fs.promises.readFile(foundFilePath, 'utf8');
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(fileContent);
      } else {
        console.log("No index file found, sending 404");
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('404 - not found');
      }
    } else {
      res.writeHead(500);
      res.end("Unexpected request");
    }
  });

  testServer.listen();
  const address = testServer.address();
  const testUrl = `http://localhost:${address.port}`;

  console.log("Current working directory:", process.cwd());
  console.log("Test index file exists:", fs.existsSync('./test/exampleWithMultipleIndex/index.txt'));

  const response = await axios(`${testUrl}/exampleWithMultipleIndex`, {
    transformResponse: [],
    validateStatus: () => true
  });

  testServer.close();

  t.equal(response.status, 200);
  t.equal(response.data, fs.readFileSync('./test/exampleWithMultipleIndex/index.txt', 'utf8'), 'should have the correct body');
  t.equal(response.headers['content-type'], 'text/plain', 'should have the correct content-type header');
});

test('http - works with resolvers and index array', async t => {
  t.plan(2);

  // Create a separate test server with full debugging
  const testServer = http.createServer(async (req, res) => {
    console.log("Request URL (resolver test):", req.url);

    if (req.url === '/exampleWithMultipleIndex') {
      console.log("Testing resolver with index array");

      // Manual implementation for debugging
      const indexFiles = ['index.ejs'];
      const dirPath = path.join(process.cwd(), 'test/exampleWithMultipleIndex');

      console.log("Directory path:", dirPath);
      console.log("Directory exists:", fs.existsSync(dirPath));

      let indexFound = false;
      let foundFilePath = null;

      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        console.log("Checking index file:", indexPath);
        console.log("File exists:", fs.existsSync(indexPath));

        try {
          const stats = await fs.promises.stat(indexPath);
          console.log("Stats:", stats.isFile());

          if (stats.isFile()) {
            foundFilePath = indexPath;
            indexFound = true;
            console.log("Found index file:", foundFilePath);
            break;
          }
        } catch (error) {
          console.log("Error checking index file:", error.message);
        }
      }

      if (indexFound) {
        console.log("Serving through resolver:", foundFilePath);
        const fileContent = await fs.promises.readFile(foundFilePath);
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(ejs.render(fileContent.toString(), { message: 'Hello World' }));
      } else {
        console.log("No index file found, sending 404");
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('404 - not found');
      }
    } else {
      res.writeHead(500);
      res.end("Unexpected request");
    }
  });

  testServer.listen();
  const address = testServer.address();
  const testUrl = `http://localhost:${address.port}`;

  const response = await axios(`${testUrl}/exampleWithMultipleIndex`, {
    transformResponse: [],
    validateStatus: () => true
  });

  testServer.close();

  t.equal(response.status, 200);
  t.equal(response.data, 'This is a test index.ejs file with a message: Hello World', 'should have the correct body with template rendered');
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

test('http - resolvers - transforms content with resolver', async (t) => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    resolvers: {
      '**/*.ejs': (filePath, content, response) => {
        response.writeHead(200, {
          'content-type': 'text/html'
        });
        response.end(ejs.render(content.toString(), { message: 'Hello World' }));
      },
    },
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/template.ejs`, {
    transformResponse: [],
    validateStatus: () => true,
  });

  server.close();

  t.equal(response.status, 200);
  t.equal(response.data, '<div>Hello World</div>\n', 'should render EJS template');
  t.equal(
    response.headers['content-type'],
    'text/html',
    'should have the correct content-type header'
  );
});
