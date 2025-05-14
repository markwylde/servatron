import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
  resolvers?: { [pattern: string]: (filePath: string, content: Buffer, response: ServerResponse) => void }
}

function send404 (options: ServatronHttpOptions, request: IncomingMessage, response: ServerResponse) {
  const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(request.headers) : null;

  if (options.spa && options.spaIndex) {
    // Check if a resolver matches the spaIndex
    if (options.resolvers) {
      for (const pattern in options.resolvers) {
        if (minimatch(options.spaIndex, pattern)) {
          const resolver = options.resolvers[pattern];
          fs.readFile(options.spaIndex, async (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) {
              console.error(`Error reading spaIndex file ${options.spaIndex}:`, err);
              response.writeHead(500, { ...antiCorsHeaders, 'content-type': 'text/plain' });
              response.end('Internal Server Error');
              return;
            }
            try {
              for (const [headerKey, headerValue] of Object.entries(antiCorsHeaders || {})) {
                response.setHeader(headerKey, headerValue as string | string[]);
              }
              await resolver(options.spaIndex as string, data, response);
            } catch (error) {
              console.error('Error in SPA resolver:', error);
              response.writeHead(500, { ...antiCorsHeaders, 'content-type': 'text/plain' });
              response.end('Internal Server Error');
            }
          });
          return;
        }
      }
    }

    // No resolver matched or no resolvers defined, serve SPA index directly
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
const servatron = (optionsInput?: ServatronHttpOptions) => { // optionsInput is now optional
  const currentOptions: ServatronHttpOptions = { // Renamed options to currentOptions
    directory: process.cwd(), // Default directory
    ...optionsInput, // Spread optionsInput
  };

  // Ensure directory is always a non-empty array or a string.
  if (!currentOptions.directory || (Array.isArray(currentOptions.directory) && currentOptions.directory.length === 0)) {
    currentOptions.directory = process.cwd();
  }

  const directories = Array.isArray(currentOptions.directory) ? currentOptions.directory : [currentOptions.directory];

  // Determine the base path for SPA index, ensuring it's a string.
  let spaBasePath: string;
  if (Array.isArray(currentOptions.directory)) {
    // We've ensured currentOptions.directory is not an empty array above
    spaBasePath = currentOptions.directory[0];
  } else {
    // currentOptions.directory must be a string here
    spaBasePath = currentOptions.directory;
  }

  if (currentOptions.spa) {
    const spaIndexFile = currentOptions.spaIndex || 'index.html';
    currentOptions.spaIndex = path.join(spaBasePath, spaIndexFile);
    getPathInfo(currentOptions.spaIndex).then(pathInfo => {
      if (pathInfo !== PathType.File) {
        console.log(`--spa mode will not work as index file (${currentOptions.spaIndex}) not found`);
      }
    });
  }

  return async (request: IncomingMessage, response: ServerResponse) => {
    let decodedPath;
    try {
      // Extract just the path part without query string
      const urlPath = request.url?.split('?')[0] || '';
      decodedPath = decodeURIComponent(urlPath);
    } catch (error) {
      send404(currentOptions, request, response); // Use currentOptions
      return;
    }

    const normalizedPath = path.normalize('/' + decodedPath);
    const found = await searchDirectoriesForPath(directories, normalizedPath.slice(1));

    if (!found) {
      send404(currentOptions, request, response); // Use currentOptions
      return;
    }

    let filePath = found.filePath;

    // Handle directory request
    if (found.filePathType === PathType.Directory) {
      let indexFilePath = null;

      // Check for index files if configured
      if (currentOptions.index && currentOptions.index.length > 0) { // Use currentOptions
        for (const indexFile of currentOptions.index) { // Use currentOptions
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
        send404(currentOptions, request, response); // Use currentOptions
        return;
      }

      // Update the file path to the found index file
      filePath = indexFilePath;
    }

    const antiCorsHeaders = currentOptions.antiCors ? generateAntiCorsHeaders(request.headers) : null; // Use currentOptions
    const contentType = mime.getType(filePath) || 'application/octet-stream';

    // Only adjust content type for index files that don't have a recognized mime type
    let adjustedContentType = contentType;
    if (contentType === 'application/octet-stream' && currentOptions.index && currentOptions.index.length > 0) { // Use currentOptions
      // Check if this is one of our configured index files
      const fileName = path.basename(filePath);
      if (currentOptions.index.includes(fileName)) { // Use currentOptions
        // This is a configured index file with no recognized mime type, use text/html
        adjustedContentType = 'text/html';
      }
    }

    if (currentOptions.resolvers) { // Use currentOptions
      let resolverMatched = false;
      for (const pattern in currentOptions.resolvers) { // Use currentOptions
        if (minimatch(filePath, pattern)) {
          resolverMatched = true;
          const resolver = currentOptions.resolvers[pattern]; // Use currentOptions
          try {
            const data = await fs.promises.readFile(filePath);
            for (const [headerKey, headerValue] of Object.entries(antiCorsHeaders || {})) {
              response.setHeader(headerKey, headerValue);
            }
            await resolver(filePath, data, response);
          } catch (error) {
            console.error('Error in resolver:', error);
            send404(currentOptions, request, response); // Use currentOptions
          }
          return;
        }
      }
      if (!resolverMatched) {
        // No resolver matched, proceed with default behavior
        response.writeHead(200, {
          ...antiCorsHeaders,
          'content-type': adjustedContentType
        });
        fs.createReadStream(filePath).pipe(response);
      }
    } else {
      // No resolvers specified, proceed with default behavior
      response.writeHead(200, {
        ...antiCorsHeaders,
        'content-type': adjustedContentType
      });
      fs.createReadStream(filePath).pipe(response);
    }
  };
}

export default servatron;
