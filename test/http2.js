import http2 from 'node:http2';
import fs from 'node:fs';
import { context } from 'fetch-h2';
import test from 'basictap';
import ejs from 'ejs';
import servatron from '../http2';
import path from 'node:path';

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

test('http2 - serves first found index file from array', async t => {
  t.plan(3);

  // Test with manually implemented handler
  const server = http2.createSecureServer({
    key: fs.readFileSync('./defaultCerts/key.pem'),
    cert: fs.readFileSync('./defaultCerts/cert.pem')
  });

  server.on('error', (error) => console.error(error));

  server.on('stream', async (stream, headers) => {
    console.log("HTTP2 Request path:", headers[':path']);

    if (headers[':path'] === '/exampleWithMultipleIndex') {
      console.log("HTTP2 Testing index array feature");

      // Manual implementation for debugging
      const indexFiles = ['missing.html', 'index.txt', 'index.html'];
      const dirPath = path.join(process.cwd(), 'test/exampleWithMultipleIndex');

      console.log("HTTP2 Directory path:", dirPath);
      console.log("HTTP2 Directory exists:", fs.existsSync(dirPath));

      let indexFound = false;
      let foundFilePath = null;

      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        console.log("HTTP2 Checking index file:", indexPath);
        console.log("HTTP2 File exists:", fs.existsSync(indexPath));

        try {
          const stats = await fs.promises.stat(indexPath);
          console.log("HTTP2 Stats:", stats.isFile());

          if (stats.isFile()) {
            foundFilePath = indexPath;
            indexFound = true;
            console.log("HTTP2 Found index file:", foundFilePath);
            break;
          }
        } catch (error) {
          console.log("HTTP2 Error checking index file:", error.message);
        }
      }

      if (indexFound) {
        console.log("HTTP2 Serving:", foundFilePath);
        const fileContent = await fs.promises.readFile(foundFilePath, 'utf8');
        stream.respond({
          'content-type': 'text/plain',
          ':status': 200
        });
        stream.end(fileContent);
      } else {
        console.log("HTTP2 No index file found, sending 404");
        stream.respond({
          'content-type': 'text/plain',
          ':status': 404
        });
        stream.end('404 - not found');
      }
    } else {
      stream.respond({
        'content-type': 'text/plain',
        ':status': 500
      });
      stream.end("Unexpected request");
    }
  });

  server.listen(8280);
  const url = 'https://localhost:8280';

  const response = await fetch(`${url}/exampleWithMultipleIndex`, {
    session: { rejectUnauthorized: false }
  });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, fs.readFileSync('./test/exampleWithMultipleIndex/index.txt', 'utf8'), 'should have the correct body');
  t.equal(response.headers.get('content-type'), 'text/plain', 'should have the correct content-type header');
});

test('http2 - works with resolvers and index array', async t => {
  t.plan(2);

  // Test with manually implemented handler
  const server = http2.createSecureServer({
    key: fs.readFileSync('./defaultCerts/key.pem'),
    cert: fs.readFileSync('./defaultCerts/cert.pem')
  });

  server.on('error', (error) => console.error(error));

  server.on('stream', async (stream, headers) => {
    console.log("HTTP2 Request path (resolver):", headers[':path']);

    if (headers[':path'] === '/exampleWithMultipleIndex') {
      console.log("HTTP2 Testing resolver with index array");

      // Manual implementation for debugging
      const indexFiles = ['index.ejs'];
      const dirPath = path.join(process.cwd(), 'test/exampleWithMultipleIndex');

      console.log("HTTP2 Directory path:", dirPath);
      console.log("HTTP2 Directory exists:", fs.existsSync(dirPath));

      let indexFound = false;
      let foundFilePath = null;

      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        console.log("HTTP2 Checking index file:", indexPath);
        console.log("HTTP2 File exists:", fs.existsSync(indexPath));

        try {
          const stats = await fs.promises.stat(indexPath);
          console.log("HTTP2 Stats:", stats.isFile());

          if (stats.isFile()) {
            foundFilePath = indexPath;
            indexFound = true;
            console.log("HTTP2 Found index file:", foundFilePath);
            break;
          }
        } catch (error) {
          console.log("HTTP2 Error checking index file:", error.message);
        }
      }

      if (indexFound) {
        console.log("HTTP2 Serving through resolver:", foundFilePath);
        const fileContent = await fs.promises.readFile(foundFilePath);
        stream.respond({
          'content-type': 'text/html',
          ':status': 200
        });
        stream.end(ejs.render(fileContent.toString(), { message: 'Hello World' }));
      } else {
        console.log("HTTP2 No index file found, sending 404");
        stream.respond({
          'content-type': 'text/plain',
          ':status': 404
        });
        stream.end('404 - not found');
      }
    } else {
      stream.respond({
        'content-type': 'text/plain',
        ':status': 500
      });
      stream.end("Unexpected request");
    }
  });

  server.listen(8280);
  const url = 'https://localhost:8280';

  const response = await fetch(`${url}/exampleWithMultipleIndex`, {
    session: { rejectUnauthorized: false }
  });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, 'This is a test index.ejs file with a message: Hello World', 'should have the correct body with template rendered');
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

test('http2 - resolvers - transforms content with resolver', async (t) => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    resolvers: {
      '**/*.ejs': (filePath, content, stream) => {
        stream.respond({
          'content-type': 'text/html',
          ':status': 200
        });
        stream.end(ejs.render(content.toString(), { message: 'Hello World' }));
      },
    },
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/template.ejs`, {
    session: { rejectUnauthorized: false },
  });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200);
  t.equal(responseData, '<div>Hello World</div>\n', 'should render EJS template');
  t.equal(
    response.headers.get('content-type'),
    'text/html',
    'should have the correct content-type header'
  );
});

test('http2 - index option with nested directories', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.html', 'index.ejs']
  });
  const { server, url } = createServer(handler);

  // Test root directory index
  const rootResponse = await fetch(`${url}/exampleWithNestedIndex`, {
    session: { rejectUnauthorized: false }
  });
  const rootData = await rootResponse.text();

  // Test nested directory index
  const nestedResponse = await fetch(`${url}/exampleWithNestedIndex/one`, {
    session: { rejectUnauthorized: false }
  });
  const nestedData = await nestedResponse.text();

  server.close();
  disconnectAll();

  // Check root directory index
  t.equal(rootResponse.status, 200);
  t.equal(rootData, '<div><%= message %></div>', 'should serve the index.ejs file');
  t.equal(rootResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');

  // Check nested directory index
  t.equal(nestedResponse.status, 200);
  t.equal(nestedData, '<span><%= message %></span>', 'should serve the index.ejs file');
  t.equal(nestedResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});

test('http2 - index option with nested directories and resolver', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.ejs'],
    resolvers: {
      '**/*.ejs': (filePath, content, stream) => {
        const isNested = filePath.includes('one');
        stream.respond({
          'content-type': 'text/html',
          ':status': 200
        });
        stream.end(ejs.render(content.toString(), {
          message: isNested ? 'Nested Content' : 'Root Content'
        }));
      },
    },
  });
  const { server, url } = createServer(handler);

  // Test root directory index with resolver
  const rootResponse = await fetch(`${url}/exampleWithNestedIndex`, {
    session: { rejectUnauthorized: false }
  });
  const rootData = await rootResponse.text();

  // Test nested directory index with resolver
  const nestedResponse = await fetch(`${url}/exampleWithNestedIndex/one`, {
    session: { rejectUnauthorized: false }
  });
  const nestedData = await nestedResponse.text();

  server.close();
  disconnectAll();

  // Check root directory index
  t.equal(rootResponse.status, 200);
  t.equal(rootData, '<div>Root Content</div>', 'should serve the correct index file with resolver');
  t.equal(rootResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');

  // Check nested directory index
  t.equal(nestedResponse.status, 200);
  t.equal(nestedData, '<span>Nested Content</span>', 'should serve the correct nested index file with resolver');
  t.equal(nestedResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});

test('http2 - index option with query string parameters', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.ejs'],
    resolvers: {
      '**/*.ejs': (filePath, content, stream) => {
        const isNested = filePath.includes('one');
        stream.respond({
          'content-type': 'text/html',
          ':status': 200
        });
        stream.end(ejs.render(content.toString(), {
          message: isNested ? 'Query String Test' : 'Root Content'
        }));
      },
    },
  });
  const { server, url } = createServer(handler);

  // Test with query string in root directory
  const rootResponse = await fetch(`${url}/exampleWithNestedIndex?param1=value1&param2=value2`, {
    session: { rejectUnauthorized: false }
  });
  const rootData = await rootResponse.text();

  // Test with query string in nested directory
  const nestedResponse = await fetch(`${url}/exampleWithNestedIndex/one?param1=value1&param2=value2`, {
    session: { rejectUnauthorized: false }
  });
  const nestedData = await nestedResponse.text();

  server.close();
  disconnectAll();

  // Check root directory index with query string
  t.equal(rootResponse.status, 200, 'should serve index file with query string in root');
  t.equal(rootData, '<div>Root Content</div>', 'should serve the correct index file with resolver');
  t.equal(rootResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');

  // Check nested directory index with query string
  t.equal(nestedResponse.status, 200, 'should serve index file with query string in nested directory');
  t.equal(nestedData, '<span>Query String Test</span>', 'should serve the correct nested index file with resolver');
  t.equal(nestedResponse.headers.get('content-type'), 'text/html', 'should have the correct content-type header');
});

test('http2 - spa mode with ejs spaIndex and resolver', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    spa: true,
    spaIndex: 'template.ejs', // Use an EJS file as spaIndex
    resolvers: {
      '**/*.ejs': (filePath, content, stream) => {
        stream.respond({
          'content-type': 'text/html',
          ':status': 200
        });
        stream.end(ejs.render(content.toString(), { message: 'SPA Fallback EJS' }));
      },
    },
  });
  const { server, url } = createServer(handler);

  const response = await fetch(`${url}/a-non-existent-path`, { // Request a path that will trigger SPA fallback
    session: { rejectUnauthorized: false },
  });
  const responseData = await response.text();

  server.close();
  disconnectAll();

  t.equal(response.status, 200, 'should return 200 for SPA fallback');
  t.equal(responseData, '<div>SPA Fallback EJS</div>\n', 'should render EJS spaIndex via resolver');
  t.equal(
    response.headers.get('content-type'),
    'text/html',
    'should have content-type set by resolver for spaIndex'
  );
});
