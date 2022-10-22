import http2 from 'http2';
import http from 'http';

function generateAntiCorsHeaders (
  headers: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
) {
  return {
    'Access-Control-Allow-Origin': headers.origin || '*',
  };
}

export default generateAntiCorsHeaders;
