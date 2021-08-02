import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime';

import { PathType, getPathInfo } from './getPathInfo';
import { searchDirectoriesForPath } from './searchDirectoriesForPath';

export interface ServatronOptions {
  directory: string | Array<string>,
  spa?: boolean,
  spaIndex?: string
}

function send404 (options: ServatronOptions, request: http.IncomingMessage, response: http.ServerResponse) {
  if (options.spa && options.spaIndex) {
    response.writeHead(200, {
      'content-type': mime.getType(options.spaIndex) || 'application/octet-stream'
    });

    fs.createReadStream(options.spaIndex).pipe(response);
    return;
  }

  response.writeHead(404, {
    'content-type': 'text/plain'
  });
  response.end('404 - not found');
}

/**
 * Create a handler that will respond to a request
 * with the respond from a static file lookup.
 **/
function servatron (options: ServatronOptions) {
  options = options || { directory: process.cwd() }
  options.directory = options.directory || process.cwd();

  const directories = Array.isArray(options.directory) ? options.directory : [options.directory];

  if (options.spa) {
    options.spaIndex = path.join(directories[0], options.spaIndex || 'index.html');
    getPathInfo(options.spaIndex).then(pathInfo => {
      if (pathInfo === PathType.File) {
        console.log(`--spa mode will not work as index file (${options.spaIndex}) not found`);
      }
    });
  }

  return async function (request: http.IncomingMessage, response: http.ServerResponse) {
    const found = await searchDirectoriesForPath(directories, path.normalize('/' + request.url));

    if (!found) {
      send404(options, request, response);
      return;
    }

    let filePath = found.filePath;
    if (found.filePathType === PathType.Directory) {
      filePath = path.join(filePath, 'index.html');
      const indexStat = await getPathInfo(filePath);
      if (indexStat === PathType.NotFound) {
        send404(options, request, response);
        return;
      }
    }

    response.writeHead(200, {
      'content-type': mime.getType(filePath) || 'application/octet-stream'
    });

    fs.createReadStream(filePath).pipe(response);
  };
}

export default servatron;

if (module) {
  module.exports = servatron;
}
