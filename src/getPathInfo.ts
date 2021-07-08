import * as fs from 'fs';

export enum PathType {
  NotFound = 'NOT_FOUND',
  File = 'FILE',
  Directory = 'DIRECTORY'
}

interface FsError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

export function getPathInfo (filePath: string) : Promise<PathType> {
  return new Promise<PathType>((resolve) => {
    const stream = fs.createReadStream(filePath);

    stream.on('readable', () => {
      resolve(PathType.File);
      stream.close();
    });

    stream.on('error', (error: FsError) => {
      if (error.code === 'ENOENT') {
        resolve(PathType.NotFound);
        return;
      }

      resolve(PathType.Directory);
    });
  });
}

export default getPathInfo;
