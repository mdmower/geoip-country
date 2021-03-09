import {GwaLog} from './log';
import {URL} from 'url';

const LOG_TAG = 'GwaCors';

/**
 * Options for GwaCors initialization
 */
interface CorsOptions {
  /**
   * Array of allowed CORS origins
   */
  origins: string[] | null;

  /**
   * RegEx test for allowed CORS origins
   */
  originRegEx: RegExp | string | null;
}

export default class GwaCors {
  private origins_: string[] | null;
  private originRegEx_: RegExp | null;
  /**
   * @param options Cross-origin requests options
   * @param log_ Log instance
   */
  constructor(options: CorsOptions, private log_: GwaLog) {
    this.origins_ = this.sanitizeOrigins(options.origins || null);
    this.originRegEx_ = this.parseOriginsRegEx(options.originRegEx || null);
  }

  /**
   * Validate URL format of each entry in an array of origins and return the sanitized entries
   * @param origins Origins array
   */
  sanitizeOrigins(origins: string[] | null): string[] | null {
    if (!Array.isArray(origins)) {
      return null;
    }

    const sanitizedOrigins = origins
      .map((o) => o.trim())
      .filter(Boolean)
      .map((o) => {
        try {
          return new URL(o).origin;
        } catch (ex) {
          this.log_.error(`[${LOG_TAG}] Invalid origin ${o}\n`, ex);
        }
        return '';
      })
      .filter(Boolean);

    return sanitizedOrigins.length ? sanitizedOrigins : null;
  }

  /**
   * Set the origins array for allowed cross-origin requests
   * @param  origins Origins array
   */
  setOrigins(origins: string[] | null): void {
    this.origins_ = this.sanitizeOrigins(origins);
  }

  /**
   * Construct (if necessary) the RegEx origin test
   * @param originRegEx Origins RegEx
   */
  parseOriginsRegEx(originRegEx: RegExp | string | null): RegExp | null {
    if (typeof originRegEx === 'string') {
      try {
        return new RegExp(originRegEx, 'i');
      } catch (ex) {
        this.log_.error(`[${LOG_TAG}] Failed to origin RegEx\n`, ex);
      }
    } else if (originRegEx instanceof RegExp) {
      return originRegEx;
    }

    return null;
  }

  /**
   * Set the origins RegEx for allowed cross-origin requests
   * @param originRegEx Origins RegEx
   */
  setOriginRegEx(originRegEx: RegExp | string | null): void {
    this.originRegEx_ = this.parseOriginsRegEx(originRegEx);
  }

  /**
   * Check whether origin is an allowed CORS origin
   * @param origin Origin header value from HTTP request
   */
  isCorsOrigin(origin: string): boolean {
    return (
      Boolean(origin) &&
      ((Array.isArray(this.origins_) && this.origins_.includes(origin)) ||
        (this.originRegEx_ != null && this.originRegEx_.test(origin)))
    );
  }

  /**
   * Get CORS headers (if appropriate) for origin
   * @param {string|undefined} origin Origin header value from HTTP request
   * @returns {?Object.<string, string>}
   */
  getCorsHeaders(origin?: string): {[header: string]: string} | null {
    return origin && this.isCorsOrigin(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
        }
      : null;
  }
}

export {GwaCors, CorsOptions};
