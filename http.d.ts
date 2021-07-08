import * as http from 'http';
export interface ServatronOptions {
    directory: string | Array<string>;
    spa?: boolean;
    spaIndex?: string;
}
/**
 * Create a handler that will respond to a request
 * with the respond from a static file lookup.
 **/
declare function servatron(options: ServatronOptions): (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void>;
export default servatron;
