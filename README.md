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
--directory (-d) pathName      specify a directory to server the files from
--port (-p) number             what port to listen on
--spa                          when a path is not found, deliver the index.html file
```

### Code
```javascript
const http = require('http');
const servatron = require('servatron');

const staticHandler = servatron({
  directory: './dist',
  spa: true
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
).listen(8000)
```
