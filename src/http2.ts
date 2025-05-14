import type { IncomingHttpHeaders, ServerHttp2Stream } from 'node:http2';
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import mime from 'mime';
import { minimatch } from 'minimatch';

import { PathType, getPathInfo } from './getPathInfo.js';
import { searchDirectoriesForPath } from './searchDirectoriesForPath.js';
import generateAntiCorsHeaders from './generateAntiCorsHeaders.js';

export interface ServatronHttp2Options {
  directory: string | Array<string>,
  spa?: boolean,
  spaIndex?: string,
  antiCors?: boolean,
  index?: Array<string>,
  // Use ServerHttp2Stream from node:http2 types
  resolvers?: { [pattern: string]: (filePath: string, content: Buffer, stream: ServerHttp2Stream) => void }
}

// Removed duplicate interface definition

function send404 (options: ServatronHttp2Options, stream: ServerHttp2Stream, headers: IncomingHttpHeaders) {
  const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(headers) : null;

  if (options.spa && options.spaIndex) {
    // Check if a resolver matches the spaIndex
    if (options.resolvers) {
      for (const pattern in options.resolvers) {
        if (minimatch(options.spaIndex, pattern)) {
          const resolver = options.resolvers[pattern];
          fs.readFile(options.spaIndex, async (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) {
              console.error(`Error reading spaIndex file ${options.spaIndex}:`, err);
              stream.respond({ ...antiCorsHeaders, 'content-type': 'text/plain', ':status': 500 });
              stream.end('Internal Server Error');
              return;
            }
            try {
              if (antiCorsHeaders) {
                stream.additionalHeaders(antiCorsHeaders);
              }
              await resolver(options.spaIndex as string, data, stream);
            } catch (error) {
              console.error('Error in SPA resolver:', error);
              stream.respond({ ...antiCorsHeaders, 'content-type': 'text/plain', ':status': 500 });
              stream.end('Internal Server Error');
            }
          });
          return;
        }
      }
    }
    // No resolver matched or no resolvers defined, serve SPA index directly
    stream.respond({
      ...antiCorsHeaders,
      'content-type': mime.getType(options.spaIndex) || 'application/octet-stream',
      ':status': 200
    });

    fs.createReadStream(options.spaIndex).pipe(stream);
    return;
  }

  stream.respond({
    ...antiCorsHeaders,
    'content-type': 'text/plain',
    ':status': 404
  });
  stream.end('404 - not found');
}

/**
 * Create a handler that will respond to a request
 * with the response from a static file lookup.
 **/
const servatron = (optionsInput?: ServatronHttp2Options) => {
  const options: ServatronHttp2Options = {
    directory: process.cwd(),
    ...optionsInput,
  };

  // Ensure directory is always a non-empty array or a string.
  if (!options.directory || (Array.isArray(options.directory) && options.directory.length === 0)) {
    options.directory = process.cwd();
  }

  const directories = Array.isArray(options.directory) ? options.directory : [options.directory];

  // Determine the base path for SPA index, ensuring it's a string.
  let spaBasePath: string;
  if (Array.isArray(options.directory)) {
    spaBasePath = options.directory[0]; // Must have at least one element due to the check above
  } else {
    spaBasePath = options.directory; // It's a string
  }

  if (options.spa) {
    const spaIndexFile = options.spaIndex || 'index.html';
    options.spaIndex = path.join(spaBasePath, spaIndexFile);
    getPathInfo(options.spaIndex).then(pathInfo => {
      if (pathInfo !== PathType.File) {
        console.log(`--spa mode will not work as index file (${options.spaIndex}) not found`);
      }
    });
  }

  return async (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => {
    let decodedPath;
    try {
      // Extract just the path part without query string
      const urlPath = (headers[':path'] as string)?.split('?')[0] || '';
      decodedPath = decodeURIComponent(urlPath);
    } catch (error) {
      send404(options, stream, headers);
      return;
    }
    const normalizedPath = path.normalize('/' + decodedPath);
    const found = await searchDirectoriesForPath(directories, normalizedPath.slice(1));

    if (!found) {
      send404(options, stream, headers);
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
        send404(options, stream, headers);
        return;
      }

      // Update the file path to the found index file
      filePath = indexFilePath;
    }

    const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(headers) : null;
    const contentType = mime.getType(filePath) || 'application/octet-stream';

    // Only adjust content type for index files that don't have a recognized mime type
    let adjustedContentType = contentType;
    if (contentType === 'application/octet-stream' && options.index && options.index.length > 0) {
      // Check if this is one of our configured index files
      const fileName = path.basename(filePath);
      if (options.index.includes(fileName)) {
        // This is a configured index file with no recognized mime type, use text/html
        adjustedContentType = 'text/html';
      }
    }

    if (options.resolvers) {
      let resolverMatched = false;
      for (const pattern in options.resolvers) {
        if (minimatch(filePath, pattern)) {
          resolverMatched = true;
          const resolver = options.resolvers[pattern];
          try {
            const data = await fs.promises.readFile(filePath);
            for (const [headerKey, headerValue] of Object.entries(antiCorsHeaders || {})) {
              stream.additionalHeaders({
                [headerKey]: headerValue
              });
            }
            await resolver(filePath, data, stream);
          } catch (error) {
            console.error('Error in resolver:', error);
            send404(options, stream, headers);
          }
          return;
        }
      }
      if (!resolverMatched) {
        // No resolver matched, proceed with default behavior
        stream.respond({
          ...antiCorsHeaders,
          'content-type': adjustedContentType,
          ':status': 200
        });
        fs.createReadStream(filePath).pipe(stream);
      }
    } else {
      // No resolvers specified, proceed with default behavior
      stream.respond({
        ...antiCorsHeaders,
        'content-type': adjustedContentType,
        ':status': 200
      });
      fs.createReadStream(filePath).pipe(stream);
    }
  };
}

export default servatron;
