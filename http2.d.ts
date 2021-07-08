import * as http2 from 'http2';
export interface ServatronOptions {
    directory: string | Array<string>;
    spa?: boolean;
    spaIndex?: string;
}
/**
 * Create a handler that will respond to a request
 * with the respond from a static file lookup.
 **/
declare function servatron(options: ServatronOptions): (stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders) => Promise<void>;
export default servatron;
