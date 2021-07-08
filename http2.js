"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mime = __importStar(require("mime"));
const getPathInfo_1 = require("./getPathInfo");
const searchDirectoriesForPath_1 = require("./searchDirectoriesForPath");
function send404(options, stream) {
    if (options.spa && options.spaIndex) {
        stream.respond({
            'content-type': mime.getType(options.spaIndex) || 'application/octet-stream',
            ':status': 200
        });
        fs.createReadStream(options.spaIndex).pipe(stream);
        return;
    }
    stream.respond({
        'content-type': 'text/plain',
        ':status': 404
    });
    stream.end('404 - not found');
}
/**
 * Create a handler that will respond to a request
 * with the respond from a static file lookup.
 **/
function servatron(options) {
    options = options || { directory: process.cwd() };
    options.directory = options.directory || process.cwd();
    const directories = Array.isArray(options.directory) ? options.directory : [options.directory];
    if (options.spa) {
        options.spaIndex = path.join(directories[0], options.spaIndex || 'index.html');
        getPathInfo_1.getPathInfo(options.spaIndex).then(pathInfo => {
            if (pathInfo === getPathInfo_1.PathType.File) {
                console.log(`--spa mode will not work as index file (${options.spaIndex}) not found`);
            }
        });
    }
    return function (stream, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const found = yield searchDirectoriesForPath_1.searchDirectoriesForPath(directories, path.normalize(headers[':path'] || '/'));
            if (!found) {
                send404(options, stream);
                return;
            }
            let filePath = found.filePath;
            if (found.filePathType === getPathInfo_1.PathType.Directory) {
                filePath = path.join(filePath, 'index.html');
                const indexStat = yield getPathInfo_1.getPathInfo(filePath);
                if (indexStat === getPathInfo_1.PathType.NotFound) {
                    send404(options, stream);
                    return;
                }
            }
            stream.respond({
                'content-type': mime.getType(filePath) || 'application/octet-stream',
                ':status': 200
            });
            fs.createReadStream(filePath).pipe(stream);
        });
    };
}
exports.default = servatron;
