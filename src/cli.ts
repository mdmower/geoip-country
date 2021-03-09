#!/usr/bin/env node

import minimist from 'minimist';
import {GwaServer} from './server';
import {assertPath, expandTildePath} from './utils';
import {createInterface} from 'readline';
import {AppOptions, getDefaultOptions, overlayOptions} from './options';
import {readFileSync} from 'fs';

const LOG_TAG = 'GwaCli';

class GwaCli {
  /**
   * Run the CLI application
   */
  async run(): Promise<void> {
    // Import custom config options
    let options: AppOptions;
    const argv = minimist(process.argv.slice(2));
    if (argv.config) {
      const config = typeof argv.config === 'string' ? argv.config.trim() : undefined;
      if (!config) {
        throw new Error('Invalid custom config path');
      }

      const configPath = config.replace(/^['"\s]|['"\s]$/g, '');
      try {
        options = this.getUserOptions(expandTildePath(configPath));
      } catch (ex) {
        throw new Error(`Failed to read custom config at ${configPath}`);
      }
    } else {
      options = getDefaultOptions();
    }

    // Verify database available and exit early if not
    const dbPath =
      (options.maxmind.dbPath && expandTildePath(options.maxmind.dbPath)) ||
      (options.ip2location.dbPath && expandTildePath(options.ip2location.dbPath));
    try {
      assertPath(dbPath);
    } catch (ex) {
      throw new Error(`Could not read database at ${dbPath}`);
    }

    const gwaServer = new GwaServer(options);
    await gwaServer.start();
    console.log(`[${LOG_TAG}] Type CTRL+C to exit`);
  }

  /**
   * Import custom configuration
   * @param path Path to custom configuration file
   */
  private getUserOptions(path: string): AppOptions {
    if (!path.trim()) {
      return getDefaultOptions();
    }

    const customConfigText = readFileSync(path, {encoding: 'utf8'});
    return overlayOptions(JSON.parse(customConfigText));
  }
}

try {
  process.on('SIGINT', () => {
    process.exit(0);
  });

  if (process.platform === 'win32') {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('SIGINT', function () {
      process.exit(0);
    });
  }

  new GwaCli().run().catch((err) => {
    console.error(
      `[${LOG_TAG}] ${err instanceof Error ? err.message : 'Unknown server startup failure'}`
    );
    process.exitCode = 1;
  });
} catch (ex) {
  console.error(`[${LOG_TAG}] ${ex instanceof Error ? ex.message : 'Unknown application failure'}`);
  process.exitCode = 1;
}
