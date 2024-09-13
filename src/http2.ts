import http2 from 'http2';
import fs from 'fs';
import path from 'path';
import mime from 'mime';

import { PathType, getPathInfo } from './getPathInfo.js';
import { searchDirectoriesForPath } from './searchDirectoriesForPath.js';
import generateAntiCorsHeaders from './generateAntiCorsHeaders.js';

export interface ServatronHttp2Options {
  directory: string | Array<string>,
  spa?: boolean,
  spaIndex?: string,
  antiCors?: boolean
}

function send404 (options: ServatronHttp2Options, stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders) {
  const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(headers) : null;

  if (options.spa && options.spaIndex) {
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
function servatron(options: ServatronHttp2Options) {
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

  return async function (stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders) {
    let decodedPath
    try {
      decodedPath = decodeURIComponent(headers[':path'] as string);
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
    if (found.filePathType === PathType.Directory) {
      filePath = path.join(filePath, 'index.html');
      const indexStat = await getPathInfo(filePath);
      if (indexStat === PathType.NotFound) {
        send404(options, stream, headers);
        return;
      }
    }

    const antiCorsHeaders = options.antiCors ? generateAntiCorsHeaders(headers) : null;
    stream.respond({
      ...antiCorsHeaders,
      'content-type': mime.getType(filePath) || 'application/octet-stream',
      ':status': 200
    });

    fs.createReadStream(filePath). pipe(stream);
  };
}

export default servatron;
