const fs = require('fs');
const path = require('path');
const mime = require('mime');

function getStats (filePath) {
  return new Promise(resolve => {
    const stream = fs.createReadStream(filePath);

    stream.on('readable', () => {
      resolve({
        isDirectory: false
      });
      stream.close();
    });

    stream.on('error', error => {
      if (error.code === 'ENOENT') {
        resolve(false);
        return;
      }

      resolve({
        isDirectory: true
      });
    });
  });
}

function send404 (options, request, response) {
  if (options.spa) {
    response.writeHead(200, {
      'content-type': mime.getType(options.spaIndex)
    });

    fs.createReadStream(options.spaIndex).pipe(response);
    return;
  }

  response.writeHead(404, {
    'content-type': 'text/plain'
  });

  response.end('404 - not found');
}

async function searchDirectories (directories, pathname) {
  for (const directory of directories) {
    const filePath = path.join(directory, pathname);
    const stat = await getStats(filePath);

    if (stat) {
      return {
        directory,
        filePath,
        stat
      };
    }
  }
}

function createHandler (options = {}) {
  options.directory = options.directory || process.cwd();
  const directories = Array.isArray(options.directory) ? options.directory : [options.directory];

  if (options.spa) {
    options.spaIndex = path.join(directories[0], options.spa === true ? 'index.html' : options.spa);
    getStats(options.spaIndex).then(stat => {
      if (!stat) {
        console.log(`--spa mode will not work as index file (${options.spaIndex}) not found`);
      }
    });
  }

  return async function (request, response) {
    const found = await searchDirectories(directories, path.normalize('/' + request.url));

    if (!found) {
      send404(options, request, response);
      return;
    }

    let filePath = found.filePath;
    if (found.stat.isDirectory) {
      filePath = path.join(filePath, 'index.html');
      const indexStat = await getStats(filePath);
      if (!indexStat) {
        send404(options, request, response);
        return;
      }
    }

    response.writeHead(200, {
      'content-type': mime.getType(filePath)
    });

    fs.createReadStream(filePath).pipe(response);
  };
}

module.exports = createHandler;
