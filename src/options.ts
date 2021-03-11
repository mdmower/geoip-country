import {CorsOptions} from './cors';
import {DbProvider, GwaDbOptions} from './db';
import {IP2LocationOptions} from './db-interface/ip2location';
import {LogLevel} from './log';
import {MaxMindOptions} from './db-interface/maxmind';
import {expandTildePath, typedKeys} from './utils';
import {join as pathJoin} from 'path';

// const LOG_TAG = 'GwaOptions';

/**
 * geoip-web-api application initialization options
 */
interface AppOptions {
  /**
   * Loging level
   */
  logLevel: LogLevel;

  /**
   * Port where HTTP server should listen
   */
  port: number;

  /**
   * Individual outputs that should be included in the response
   */
  enabledOutputs: {
    /**
     * Enable country code output
     */
    country: boolean;

    /**
     * Enable subdivision code output
     */
    subdivision: boolean;

    /**
     * Enable IP output
     */
    ip: boolean;

    /**
     * Enable IP number output
     */
    ip_version: boolean;

    /**
     * Enable raw data output from DB lookup
     */
    data: boolean;
  };

  /**
   * Pretty JSON output
   */
  prettyOutput: boolean;

  /**
   * Dictionary of HTTP response headers for GET requests
   */
  getHeaders: {[header: string]: string | null};

  /**
   * Array of paths to match for GET requests
   */
  getPaths: string[];

  /**
   * Allowed CORS origin tests
   */
  cors: CorsOptions;

  /**
   * MaxMind database and reader options
   */
  maxmind: MaxMindOptions;

  /**
   * IP2Location database and reader options
   */
  ip2location: IP2LocationOptions;
}

/**
 * Get default options
 */
function getDefaultOptions(): AppOptions {
  // Suggested headers for AMP-GEO fallback API:
  // https://github.com/ampproject/amphtml/blob/master/spec/amp-framework-hosting.md#amp-geo-fallback-api
  return {
    logLevel: LogLevel.INFO,
    port: 3000,
    enabledOutputs: {
      country: true,
      subdivision: true,
      ip: false,
      ip_version: false,
      data: false,
    },
    prettyOutput: false,
    getHeaders: {},
    getPaths: ['/', '/*'],
    cors: {
      origins: null,
      originRegEx: null,
    },
    maxmind: {
      dbPath: pathJoin(process.cwd(), 'GeoLite2-Country.mmdb'),
    },
    ip2location: {
      dbPath: '',
      subdivisionCsvPath: '',
    },
  };
}

/**
 * Safely overlay values in default options object with user options object
 * @param unsafeSrc Source options
 */
function overlayOptions(unsafeSrc?: any): AppOptions {
  const target = getDefaultOptions();
  const src = unsafeSrc instanceof Object ? (unsafeSrc as Record<string, any>) : undefined;
  if (!src) {
    return target;
  }

  // Log level
  const logLevel = typeof src.logLevel === 'number' ? src.logLevel : undefined;
  if (logLevel !== undefined && logLevel >= LogLevel.OFF && logLevel <= LogLevel.DEBUG) {
    target.logLevel = Math.floor(logLevel) as LogLevel;
  }

  // Only set HTTP server port if a valid value is available
  const port = typeof src.port === 'number' ? src.port : undefined;
  if (port !== undefined && port >= 0 && port <= 65535) {
    target.port = Math.floor(port);
  }

  // Enabled outputs
  const enabledOutputs =
    src.enabledOutputs instanceof Object ? (src.enabledOutputs as Record<string, any>) : undefined;
  if (enabledOutputs) {
    typedKeys(target.enabledOutputs).forEach((output) => {
      const outputValue =
        typeof enabledOutputs[output] === 'boolean'
          ? (enabledOutputs[output] as boolean)
          : undefined;
      if (outputValue !== undefined) {
        target.enabledOutputs[output] = outputValue;
      }
    });
  }

  // Pretty JSON output
  if (typeof src.prettyOutput === 'boolean') {
    target.prettyOutput = src.prettyOutput;
  }

  // GET headers
  const getHeaders =
    src.getHeaders instanceof Object ? (src.getHeaders as Record<string, any>) : undefined;
  if (getHeaders) {
    target.getHeaders = {};

    // Only allow string header keys and string or null values
    // which indicate that a header should be removed (if possible).
    // Retain only the last definition of a header if multiple
    // exist with distinct cases, all the while retaining the
    // user's original casing of the header name.
    Object.keys(getHeaders).forEach((key) => {
      const headerValue =
        typeof getHeaders[key] === 'string' || getHeaders[key] === null
          ? (getHeaders[key] as string | null)
          : undefined;
      if (headerValue !== undefined) {
        const duplicateKey = Object.keys(target.getHeaders).find(
          (h) => h.toLowerCase() === key.toLowerCase()
        );
        if (duplicateKey) {
          delete target.getHeaders[duplicateKey];
        }
        target.getHeaders[key] = headerValue;
      }
    });
  }

  // Validation of GET routes via path-to-regexp package doesn't look reliable:
  // https://github.com/pillarjs/path-to-regexp#compatibility-with-express--4x
  // Express seems to tolerate some very invalid path definitions. There's not
  // much to do here other than verify strings.
  const getPaths = Array.isArray(src.getPaths) ? (src.getPaths as unknown[]) : undefined;
  if (getPaths) {
    target.getPaths = getPaths.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
    // Ensure at least one path is available
    if (!target.getPaths.length) {
      target.getPaths.push('/');
    }
  }

  // CORS properties are null by default, so only modify if good values are found
  const cors = src.cors instanceof Object ? (src.cors as Record<string, any>) : undefined;
  if (cors) {
    const origins = Array.isArray(cors.origins) ? (cors.origins as unknown[]) : undefined;
    if (origins) {
      // Filter out non-string and empty values.
      // URL validity will be checked in Cors class.
      target.cors.origins = origins
        .map((o) => (typeof o === 'string' ? o.trim() : ''))
        .filter(Boolean);
    }

    const originRegEx =
      typeof cors.originRegEx === 'string' || cors.originRegEx instanceof RegExp
        ? cors.originRegEx
        : undefined;
    if (originRegEx) {
      target.cors.originRegEx = originRegEx;
    }
  }

  // MaxMind properties
  let maxMindDefined = false;
  const maxmind = src.maxmind instanceof Object ? (src.maxmind as Record<string, any>) : undefined;
  if (maxmind) {
    const dbPath = typeof maxmind.dbPath === 'string' ? maxmind.dbPath.trim() : undefined;
    if (dbPath) {
      target.maxmind.dbPath = expandTildePath(dbPath);
      maxMindDefined = true;
    }
  }

  // IP2Location properties
  if (!maxMindDefined) {
    const ip2location =
      src.ip2location instanceof Object ? (src.ip2location as Record<string, any>) : undefined;
    if (ip2location) {
      const dbPath = typeof ip2location.dbPath === 'string' ? ip2location.dbPath.trim() : undefined;
      if (dbPath) {
        target.ip2location.dbPath = expandTildePath(dbPath);
        target.maxmind.dbPath = '';
        // Subdivision support requires a separate CSV database
        const subdivisionCsvPath =
          typeof ip2location.subdivisionCsvPath === 'string'
            ? ip2location.subdivisionCsvPath.trim()
            : undefined;
        if (subdivisionCsvPath) {
          target.ip2location.subdivisionCsvPath = expandTildePath(subdivisionCsvPath);
        }
      }
    }
  }

  return target;
}

/**
 * Get options for GwaDb constructor
 * @param {AppOptions} appOptions Applications options
 */
function getDbOptions(appOptions: AppOptions): GwaDbOptions {
  const gwaDbOptions: GwaDbOptions = {
    dbProvider: DbProvider.UNKNOWN,
  };

  if (appOptions.maxmind && appOptions.maxmind.dbPath) {
    gwaDbOptions.dbProvider = DbProvider.MAXMIND;
    gwaDbOptions.maxMindOptions = appOptions.maxmind;
  } else if (appOptions.ip2location && appOptions.ip2location.dbPath) {
    gwaDbOptions.dbProvider = DbProvider.IP2LOCATION;
    gwaDbOptions.ip2LocationOptions = appOptions.ip2location;
  }

  return gwaDbOptions;
}

export {getDefaultOptions, overlayOptions, getDbOptions, AppOptions};
