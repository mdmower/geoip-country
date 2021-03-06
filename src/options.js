import {readFileSync} from 'fs';
import {join} from 'path';
import {LogLevel} from './log';
import {expandTildePath} from './utils';
import {DbProvider} from './db';

/** @constant */
const LOG_TAG = 'GwaOptions';

/**
 * @typedef AppOptions
 * @property {LogLevel} logLevel Log level (0:Off, 1:Error, 2:Warn, 3:Info, 4:Debug)
 * @property {number} port Port where HTTP server should listen
 * @property {Object.<string, boolean>} enabledOutputs Individual outputs that should be included in the response
 * @property {boolean} prettyOutput Pretty JSON output
 * @property {Object.<string, ?string>} getHeaders Dictionary of HTTP response headers for GET requests
 * @property {Array<string>} getPaths Array of paths to match for GET requests
 * @property {Object} cors Allowed CORS origin tests
 * @property {?Array<string>} cors.origins Array of allowed CORS origins
 * @property {?(RegExp|string)} cors.originRegEx RegEx test for allowed CORS origins
 * @property {Object} maxmind MaxMind database and reader options
 * @property {string} maxmind.dbPath Filesystem path to MaxMind database
 * @property {Object} ip2location IP2Location database and reader options
 * @property {string} ip2location.dbPath Filesystem path to IP2Location database
 * @property {string} ip2location.subdivisionCsvPath Filesystem path to IP2Location subdivision CSV database
 */

/**
 * Get default options
 * @returns {AppOptions}
 */
function getDefaultOptions() {
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
      dbPath: join(process.cwd(), 'GeoLite2-Country.mmdb'),
    },
    ip2location: {
      dbPath: '',
      subdivisionCsvPath: '',
    },
  };
}

/**
 * Safely overlay values in default options object with src options object
 * @param {Object.<string, any> | undefined} src Source options
 * @returns {AppOptions}
 * @private
 */
function overlayOptions(src) {
  const target = getDefaultOptions();
  if (!(src instanceof Object)) {
    return target;
  }

  // Log level
  if (src.logLevel >= 0 && src.logLevel <= 4) {
    target.logLevel = Math.floor(src.logLevel);
  }

  // Only set HTTP server port if a valid value is available
  if (src.port > 0) {
    target.port = Math.floor(src.port);
  }

  // Enabled outputs
  if (src.enabledOutputs instanceof Object) {
    const knownOutputs = Object.keys(target.enabledOutputs);
    Object.keys(src.enabledOutputs)
      .filter((output) => knownOutputs.includes(output))
      .forEach((output) => {
        if (typeof src.enabledOutputs[output] === 'boolean') {
          target.enabledOutputs[output] = src.enabledOutputs[output];
        }
      });
  }

  // Pretty JSON output
  if (typeof src.prettyOutput === 'boolean') {
    target.prettyOutput = src.prettyOutput;
  }

  // GET headers
  if (src.getHeaders instanceof Object) {
    target.getHeaders = {};

    // Only allow string header keys and string or null values
    // which indicate that a header should be removed (if possible).
    // Retain only the last definition of a header if multiple
    // exist with distinct cases, all the while retaining the
    // user's original casing of the header name.
    Object.keys(src.getHeaders).forEach((key) => {
      if (typeof src.getHeaders[key] === 'string' || src.getHeaders[key] === null) {
        const duplicateKey = Object.keys(target.getHeaders).find(
          (h) => h.toLowerCase() === key.toLowerCase()
        );
        if (duplicateKey) {
          delete target.getHeaders[duplicateKey];
        }
        target.getHeaders[key] = src.getHeaders[key];
      }
    });
  }

  // Validation of GET routes via path-to-regexp package doesn't look reliable:
  // https://github.com/pillarjs/path-to-regexp#compatibility-with-express--4x
  // Express seems to tolerate some very invalid path definitions. There's not
  // much to do here other than verify strings.
  if (Array.isArray(src.getPaths)) {
    target.getPaths = src.getPaths
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean);
    // Ensure at least one path is available
    if (!target.getPaths.length) {
      target.getPaths.push('/');
    }
  }

  // CORS properties are null by default, so only modify if good values are found
  if (src.cors instanceof Object) {
    const origins = src.cors.origins;
    if (Array.isArray(origins)) {
      // Filter out non-string and empty values.
      // URL validity will be checked in Cors class.
      target.cors.origins = origins
        .map((o) => (typeof o === 'string' ? o.trim() : ''))
        .filter(Boolean);
    }

    if (
      src.cors.originRegEx &&
      (typeof src.cors.originRegEx === 'string' || src.cors.originRegEx instanceof RegExp)
    ) {
      target.cors.originRegEx = src.cors.originRegEx;
    }
  }

  // MaxMind properties
  let maxMindDefined = false;
  if (src.maxmind instanceof Object) {
    if (src.maxmind.dbPath && typeof src.maxmind.dbPath === 'string') {
      target.maxmind.dbPath = expandTildePath(src.maxmind.dbPath);
      maxMindDefined = true;
    }
  }

  // IP2Location properties
  if (!maxMindDefined) {
    if (src.ip2location instanceof Object) {
      if (src.ip2location.dbPath && typeof src.ip2location.dbPath === 'string') {
        target.ip2location.dbPath = expandTildePath(src.ip2location.dbPath);
        target.maxmind.dbPath = '';
        // Subdivision support requires a separate CSV database
        if (
          src.ip2location.subdivisionCsvPath &&
          typeof src.ip2location.subdivisionCsvPath === 'string'
        ) {
          target.ip2location.subdivisionCsvPath = expandTildePath(
            src.ip2location.subdivisionCsvPath
          );
        }
      }
    }
  }

  return target;
}

/**
 * Import custom configuration
 * @param {string} path Path to custom configuration file
 * @returns {Object.<string, any>}
 */
function getJsonOptions(path) {
  if (!path || typeof path !== 'string') {
    return {};
  }

  const customConfigText = readFileSync(path, {encoding: 'utf8'});
  return JSON.parse(customConfigText);
}

/**
 * Get options for GwaDb constructor
 * @param {AppOptions} appOptions Applications options
 * @returns {import('./db').GwaDbOptions} Database options
 */
function getDbOptions(appOptions) {
  /** @type {import('./db').GwaDbOptions} */
  const gwaDbOptions = {
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

export {getDefaultOptions, overlayOptions, getJsonOptions, getDbOptions};
export default {getDefaultOptions, overlayOptions, getJsonOptions, getDbOptions};
