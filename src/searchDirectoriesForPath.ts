import * as path from 'path';

import { PathType, getPathInfo } from './getPathInfo';

interface FoundDirectory {
  directory: string,
  filePath: string,
  filePathType: PathType
}

export async function searchDirectoriesForPath (
  directories: Array<string>,
  pathname: string
) : Promise<FoundDirectory | null> {
  for (const directory of directories) {
    const filePath = path.join(directory, pathname);
    const filePathType = await getPathInfo(filePath);

    if (filePathType !== PathType.NotFound) {
      return {
        directory,
        filePath,
        filePathType
      };
    }
  }

  return null;
}

export default searchDirectoriesForPath;
