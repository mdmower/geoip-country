const fse = require('fs-extra');
const path = require('path');

(async function () {
  try {
    const libDirPath = path.resolve(__dirname, '..', 'lib');
    await fse.emptyDir(libDirPath);
    console.log(`Clean successful: ${libDirPath}`);
  } catch (ex) {
    console.error('Unexpected error during cleanup\n', ex);
    process.exit(1);
  }
})();
