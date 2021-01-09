const fs = require('fs');
const path = require('path');
const mime = require('mime');

function getStats (filePath) {
  return fs.promises
    .stat(filePath)
    .then((stats) => {
      return {
        isDirectory: stats.isDirectory()
      };
    })
    .catch(() => false);
}

function send404 (options, request, response) {
  if (options.spa) {
    const spaIndex = path.join(options.directory, 'index.html');
    response.writeHead(200, {
      'content-type': mime.getType(spaIndex)
    });

    fs.createReadStream(spaIndex).pipe(response);
    return;
  }

  response.writeHead(404, {
    'content-type': 'text/plain'
  });

  response.end('404 - not found');
}

function createHandler (options = {}) {
  options.directory = options.directory ? path.resolve(options.directory) : process.cwd();

  if (options.spa) {
    const spaIndex = path.join(options.directory, 'index.html');

    getStats(spaIndex).then(stat => {
      if (!stat) {
        console.log(`--spa mode will not work as index file (${spaIndex}) not found`);
      }
    });
  }

  return async function (request, response) {
    let filePath = path.join(options.directory, request.url);

    const stat = await getStats(filePath);

    if (!stat) {
      send404(options, request, response);
      return;
    }

    if (stat.isDirectory) {
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
