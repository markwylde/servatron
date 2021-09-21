# servatron
An extremely lightweight static file server that can be used as a handler or cli.

## Installation
```bash
npm install --save servatron
```

(or) globally:
```bash
npm install -g servatron
```

## Usage
### CLI
```bash
servatron --directory dist --port 8000 --spa
```

Optional arguments are:

```text
--directory (-d) pathName      specify a directory to server the files from (can provider multiple)
--bind (-b) hostname           what host to bind on (default: 0.0.0.0)
--port (-p) number             what port to listen on (default: 8000)
--spa                          when a path is not found, deliver the index file
--spa-index                    what name spa mode should look for the html file (default: index.html)
--http2                        use http2 as the server protocol
--key                          what key to use for http2
--cert                         what cert to use for http2
--ca                           optionally add a ca for http2
```

### Code - HTTP 1
```javascript
const http = require('http');
const servatron = require('servatron/http');

const staticHandler = servatron({
  directory: './dist',
  spa: true,
  spaIndex: 'index.html'
})

// Use only the staticHandler
http.createServer(staticHandler).listen(8000)

// (or) Mix custom handler logic with staticHandler
http.createServer(function (request, response) {
  if (request.url.startsWith('/api')) {
    response.end('this could be an api')
    return
  }

  staticHandler(request, response)
).listen(8000, '0.0.0.0')
```

### Code - HTTP 2
```javascript
const http2 = require('http2');
const servatron = require('servatron/http2');

const server = http2.createSecureServer({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
});
server.on('error', (error) => console.error(error));

// Use only the staticHandler
server.on('stream', staticHandler);

server.listen(8000, '0.0.0.0');

// (or) Mix custom handler logic with staticHandler
server.on('stream', function (stream, headers) {
  if (headers[':path'].startsWith('/api')) {
    stream.end('this could be an api');
    return;
  }

  staticHandler(stream, header);
});

server.listen(8000, '0.0.0.0');
```
