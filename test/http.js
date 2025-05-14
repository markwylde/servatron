import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

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

test('http - index option with resolvers - tries multiple index files', async t => {
  t.plan(3);

  // Create a test directory with an index.ejs file
  const testDir = path.join('test', 'tempIndexTest');
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, 'index.ejs'), '<div><%= message %></div>');

  try {
    const handler = servatron({
      directory: 'test',
      index: ['index.html', 'index.ejs'],
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

    const response = await axios(`${url}/tempIndexTest`, {
      transformResponse: [],
      validateStatus: () => true,
    });

    server.close();

    t.equal(response.status, 200);
    t.equal(response.data, '<div>Hello World</div>', 'should render EJS template as index');
    t.equal(
      response.headers['content-type'],
      'text/html',
      'should have the correct content-type header'
    );
  } finally {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('http - index option with nested directories', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.html', 'index.ejs']
  });
  const { server, url } = createServer(handler);

  // Test root directory index
  const rootResponse = await axios(`${url}/exampleWithNestedIndex`, {
    transformResponse: [],
    validateStatus: () => true
  });

  // Test nested directory index
  const nestedResponse = await axios(`${url}/exampleWithNestedIndex/one`, {
    transformResponse: [],
    validateStatus: () => true
  });

  server.close();

  // Check root directory index
  t.equal(rootResponse.status, 200);
  t.equal(rootResponse.data, '<div><%= message %></div>', 'should serve the index.ejs file');
  t.equal(rootResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');

  // Check nested directory index
  t.equal(nestedResponse.status, 200);
  t.equal(nestedResponse.data, '<span><%= message %></span>', 'should serve the index.ejs file');
  t.equal(nestedResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - index option with nested directories and resolver', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.ejs'],
    resolvers: {
      '**/*.ejs': (filePath, content, response) => {
        const isNested = filePath.includes('one');
        response.writeHead(200, {
          'content-type': 'text/html'
        });
        response.end(ejs.render(content.toString(), {
          message: isNested ? 'Nested Content' : 'Root Content'
        }));
      },
    },
  });
  const { server, url } = createServer(handler);

  // Test root directory index with resolver
  const rootResponse = await axios(`${url}/exampleWithNestedIndex`, {
    transformResponse: [],
    validateStatus: () => true,
    headers: {
      'Accept': 'text/html,*/*'
    }
  });

  // Test nested directory index with resolver
  const nestedResponse = await axios(`${url}/exampleWithNestedIndex/one`, {
    transformResponse: [],
    validateStatus: () => true,
    headers: {
      'Accept': 'text/html,*/*'
    }
  });

  server.close();

  // Check root directory index
  t.equal(rootResponse.status, 200);
  t.equal(rootResponse.data, '<div>Root Content</div>', 'should serve the correct index file with resolver');
  t.equal(rootResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');

  // Check nested directory index
  t.equal(nestedResponse.status, 200);
  t.equal(nestedResponse.data, '<span>Nested Content</span>', 'should serve the correct nested index file with resolver');
  t.equal(nestedResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - index option with query string parameters', async t => {
  t.plan(6);

  const handler = servatron({
    directory: 'test',
    index: ['index.ejs'],
    resolvers: {
      '**/*.ejs': (filePath, content, response) => {
        const isNested = filePath.includes('one');
        response.writeHead(200, {
          'content-type': 'text/html'
        });
        response.end(ejs.render(content.toString(), {
          message: isNested ? 'Query String Test' : 'Root Content'
        }));
      },
    },
  });
  const { server, url } = createServer(handler);

  // Test with query string in root directory
  const rootResponse = await axios(`${url}/exampleWithNestedIndex?param1=value1&param2=value2`, {
    transformResponse: [],
    validateStatus: () => true,
    headers: {
      'Accept': 'text/html,*/*'
    }
  });

  // Test with query string in nested directory
  const nestedResponse = await axios(`${url}/exampleWithNestedIndex/one?param1=value1&param2=value2`, {
    transformResponse: [],
    validateStatus: () => true,
    headers: {
      'Accept': 'text/html,*/*'
    }
  });

  server.close();

  // Check root directory index with query string
  t.equal(rootResponse.status, 200, 'should serve index file with query string in root');
  t.equal(rootResponse.data, '<div>Root Content</div>', 'should serve the correct index file with resolver');
  t.equal(rootResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');

  // Check nested directory index with query string
  t.equal(nestedResponse.status, 200, 'should serve index file with query string in nested directory');
  t.equal(nestedResponse.data, '<span>Query String Test</span>', 'should serve the correct nested index file with resolver');
  t.equal(nestedResponse.headers['content-type'], 'text/html', 'should have the correct content-type header');
});

test('http - spa mode with ejs spaIndex and resolver', async t => {
  t.plan(3);

  const handler = servatron({
    directory: 'test/exampleWithIndex',
    spa: true,
    spaIndex: 'template.ejs', // Use an EJS file as spaIndex
    resolvers: {
      '**/*.ejs': (filePath, content, response) => {
        response.writeHead(200, {
          'content-type': 'text/html'
        });
        response.end(ejs.render(content.toString(), { message: 'SPA Fallback EJS' }));
      },
    },
  });
  const { server, url } = createServer(handler);

  const response = await axios(`${url}/a-non-existent-path`, { // Request a path that will trigger SPA fallback
    transformResponse: [],
    validateStatus: () => true,
  });

  server.close();

  t.equal(response.status, 200, 'should return 200 for SPA fallback');
  t.equal(response.data, '<div>SPA Fallback EJS</div>\n', 'should render EJS spaIndex via resolver');
  t.equal(
    response.headers['content-type'],
    'text/html',
    'should have content-type set by resolver for spaIndex'
  );
});
