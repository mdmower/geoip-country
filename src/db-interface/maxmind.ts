import {DbInterface} from './dbi';
import {GwaLog} from '../log';
import {assertPath} from '../utils';
import {open as mmOpen, Reader as mmReader, Response as mmResponse} from 'maxmind';

const LOG_TAG = 'GwaMaxMind';

/**
 * Options for GwaMaxMind initialization
 */
interface MaxMindOptions {
  /**
   * Filesystem path to MaxMind database
   */
  dbPath: string;
}

class GwaMaxMind implements DbInterface {
  private dbPath_: string;
  private dbReader_: mmReader<mmResponse> | undefined;

  /**
   * @param options MaxMind database and reader options
   * @param log_ Log instance
   */
  constructor(options: MaxMindOptions, private log_: GwaLog) {
    assertPath(options.dbPath);

    this.dbPath_ = options.dbPath;
  }

  /**
   * Open MaxMind database and get reader
   * @param dbPath Filesystem path to MaxMind database
   */
  private async loadDbReader(dbPath: string): Promise<void> {
    if (this.dbReader_) {
      this.log_.debug(`[${LOG_TAG}] MaxMind database reader appears to be available already`);
    }

    this.log_.debug(`[${LOG_TAG}] Preparing MaxMind database reader`);
    try {
      this.dbReader_ = await mmOpen(dbPath, {
        watchForUpdates: true,
      });
    } catch (ex) {
      this.log_.error(`[${LOG_TAG}] Failed to load MaxMind database at ${dbPath}`);
      throw ex;
    }
    this.log_.debug(`[${LOG_TAG}] MaxMind database reader ready`);
  }

  /**
   * Get MaxMind database result for IP
   * @param ip IPv4 or IPv6 address to lookup
   */
  public async get(ip: string): Promise<mmResponse | null> {
    if (!this.dbReader_) {
      await this.loadDbReader(this.dbPath_);
    }
    if (!this.dbReader_) {
      throw new Error('loadDbReader completed without populating MaxMind dbReader');
    }

    let mmResult: mmResponse | null;
    try {
      mmResult = this.dbReader_.get(ip);
      if (!mmResult) {
        throw new Error('MaxMind database search returned empty result');
      }
    } catch (ex) {
      this.log_.error(`[${LOG_TAG}] Failed to search database for IP: ${ip}`);
      return null;
    }

    return mmResult;
  }

  /**
   * Get a specific string value from the result of a MaxMind database search
   * @param mmResult Result of MaxMind database search
   * @param output Output value to fetch from database
   */
  public getStringValue(mmResult: mmResponse | null, output: string): string | null {
    if (!mmResult) {
      return null;
    }

    if (output === 'country') {
      if (!('country' in mmResult)) {
        return null;
      }

      return mmResult.country?.iso_code?.trim() || '';
    }

    if (output === 'subdivision') {
      if (!('subdivisions' in mmResult)) {
        return null;
      }

      return (
        (Array.isArray(mmResult.subdivisions) && mmResult.subdivisions[0]?.iso_code?.trim()) || ''
      );
    }

    return null;
  }
}

export {GwaMaxMind, MaxMindOptions};
