import http from 'http';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import { minimatch } from 'minimatch';

import { PathType, getPathInfo } from './getPathInfo.js';
import { searchDirectoriesForPath } from './searchDirectoriesForPath.js';
import generateAntiCorsHeaders from './generateAntiCorsHeaders.js';

export interface ServatronHttpOptions {
  directory: string | Array<string>,
  spa?: boolean,
  spaIndex?: string,
  antiCors?: boolean,
  index?: Array<string>,
  resolvers?: { [pattern: string]: (filePath: string, content: Buffer, response: http.ServerResponse) => void }
}

function send404 (options: ServatronHttpOptions, request: http.IncomingMessage, response: http.ServerResponse) {
  const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(request.headers) : null;

  if (options.spa && options.spaIndex) {
    response.writeHead(200, {
      ...antiCorsHeaders,
      'content-type': mime.getType(options.spaIndex) || 'application/octet-stream'
    });

    fs.createReadStream(options.spaIndex).pipe(response);
    return;
  }

  response.writeHead(404, {
    ...antiCorsHeaders,
    'content-type': 'text/plain'
  });
  response.end('404 - not found');
}

/**
 * Create a handler that will respond to a request
 * with the response from a static file lookup.
 **/
function servatron(options: ServatronHttpOptions) {
  options = options || { directory: process.cwd() };
  options.directory = options.directory || process.cwd();

  const directories = Array.isArray(options.directory) ? options.directory : [options.directory];

  if (options.spa) {
    options.spaIndex = path.join(directories[0], options.spaIndex || 'index.html');
    getPathInfo(options.spaIndex).then(pathInfo => {
      if (pathInfo !== PathType.File) {
        console.log(`--spa mode will not work as index file (${options.spaIndex}) not found`);
      }
    });
  }

  return async function (request: http.IncomingMessage, response: http.ServerResponse) {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(request.url as string);
    } catch (error) {
      send404(options, request, response);
      return;
    }

    const normalizedPath = path.normalize('/' + decodedPath);
    const found = await searchDirectoriesForPath(directories, normalizedPath.slice(1));

    if (!found) {
      send404(options, request, response);
      return;
    }

    let filePath = found.filePath;

    // Handle directory request
    if (found.filePathType === PathType.Directory) {
      let indexFilePath = null;

      // Check for index files if configured
      if (options.index && options.index.length > 0) {
        for (const indexFile of options.index) {
          const testPath = path.join(filePath, indexFile);
          try {
            const stats = await fs.promises.stat(testPath);
            if (stats.isFile()) {
              indexFilePath = testPath;
              break;
            }
          } catch (error) {
            // File doesn't exist, continue to next
          }
        }
      } else {
        // Default to index.html
        const defaultPath = path.join(filePath, 'index.html');
        try {
          const stats = await fs.promises.stat(defaultPath);
          if (stats.isFile()) {
            indexFilePath = defaultPath;
          }
        } catch (error) {
          // index.html not found
        }
      }

      // If no index file found, send 404
      if (!indexFilePath) {
        send404(options, request, response);
        return;
      }

      // Update the file path to the found index file
      filePath = indexFilePath;
    }

    const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(request.headers) : null;
    const contentType = mime.getType(filePath) || 'application/octet-stream';

    if (options.resolvers) {
      let resolverMatched = false;
      for (const pattern in options.resolvers) {
        if (minimatch(filePath, pattern)) {
          resolverMatched = true;
          const resolver = options.resolvers[pattern];
          try {
            const data = await fs.promises.readFile(filePath);
            for (const [headerKey, headerValue] of Object.entries(antiCorsHeaders || {})) {
              response.setHeader(headerKey, headerValue);
            }
            await resolver(filePath, data, response);
          } catch (error) {
            console.error('Error in resolver:', error);
            send404(options, request, response);
          }
          return;
        }
      }
      if (!resolverMatched) {
        // No resolver matched, proceed with default behavior
        response.writeHead(200, {
          ...antiCorsHeaders,
          'content-type': contentType
        });
        fs.createReadStream(filePath).pipe(response);
      }
    } else {
      // No resolvers specified, proceed with default behavior
      response.writeHead(200, {
        ...antiCorsHeaders,
        'content-type': contentType
      });
      fs.createReadStream(filePath).pipe(response);
    }
  };
}

export default servatron;
