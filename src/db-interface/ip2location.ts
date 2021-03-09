import {DbInterface} from './dbi';
import {GwaLog} from '../log';
import {Ip2lReader, Ip2lData} from 'ip2ldb-reader';
import {assertPath} from '../utils';

const LOG_TAG = 'GwaIP2Location';

/**
 * Options for GwaIP2Location initialization
 */
interface IP2LocationOptions {
  /**
   * Filesystem path to IP2Location database
   */
  dbPath: string;
  /**
   * Filesystem path to IP2Location subdivision CSV database
   */
  subdivisionCsvPath?: string;
}

class GwaIP2Location implements DbInterface {
  private dbPath_: string;
  private subdivisionCsvPath_: string | undefined;
  private dbReader_: Ip2lReader | undefined;

  constructor(options: IP2LocationOptions, private log_: GwaLog) {
    assertPath(options.dbPath);

    this.dbPath_ = options.dbPath;
    this.subdivisionCsvPath_ = options.subdivisionCsvPath;
  }

  /**
   * Open IP2Location database and get reader
   * @param dbPath Filesystem path to IP2Location database
   * @param subdivisionCsvPath Filesystem path to IP2Location subdivision CSV database
   */
  private async loadDbReader(dbPath: string, subdivisionCsvPath?: string): Promise<void> {
    if (this.dbReader_) {
      this.log_.debug(`[${LOG_TAG}] IP2Location database reader appears to be available already`);
    }

    this.log_.debug(`[${LOG_TAG}] Preparing IP2Location database reader`);
    try {
      this.dbReader_ = new Ip2lReader();
      await this.dbReader_.init(dbPath, {
        reloadOnDbUpdate: true,
        subdivisionCsvPath: subdivisionCsvPath,
      });
    } catch (ex) {
      this.log_.error(`[${LOG_TAG}] Failed to load IP2Location database at ${dbPath}`);
      throw ex;
    }
    this.log_.debug(`[${LOG_TAG}] IP2Location database reader ready`);
  }

  /**
   * Get IP2Location database result for IP
   * @param ip IPv4 or IPv6 address to lookup
   */
  public async get(ip: string): Promise<Ip2lData | null> {
    if (!this.dbReader_) {
      await this.loadDbReader(this.dbPath_, this.subdivisionCsvPath_);
    }
    if (!this.dbReader_) {
      throw new Error('loadDbReader completed without populating IP2Location dbReader');
    }

    let ip2lResult: Ip2lData;
    try {
      ip2lResult = this.dbReader_.get(ip);
      if (!ip2lResult) {
        throw new Error('IP2Location database search returned empty result');
      }
    } catch (ex) {
      this.log_.error(`[${LOG_TAG}] Failed to search database for IP: ${ip}`);
      return null;
    }

    return ip2lResult;
  }

  /**
   * Get a specific string value from the result of an IP2Location database search
   * @param ip2lResult Result of IP2Location database search
   * @param output Output value to fetch from database
   */
  public getStringValue(ip2lResult: Ip2lData | null, output: string): string | null {
    if (!ip2lResult) {
      return null;
    }

    if (output === 'country') {
      if (!('country' in ip2lResult)) {
        return null;
      }
      return ip2lResult.country_short || '';
    }

    if (output === 'subdivision') {
      if (!('subdivision' in ip2lResult)) {
        return null;
      }
      return ip2lResult.subdivision || '';
    }

    return null;
  }
}

export {GwaIP2Location, IP2LocationOptions};
