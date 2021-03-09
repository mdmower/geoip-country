import express from 'express';
import {GwaCors} from './cors';
import {GwaLog} from './log';
import {GwaDb} from './db';
import {getDbOptions, AppOptions} from './options';
import {Server} from 'http';
import {typedKeys} from './utils';

const LOG_TAG = 'GwaServer';

/**
 * GeoIP API response; conforms to AMP-GEO fallback API response JSON schema version 0.2
 */
interface GeoIpApiResponse {
  /**
   * ISO 3166-1 alpha-2 country code
   */
  country?: string;

  /**
   * Subdivision part of ISO 3166-2 country-subdivision code
   */
  subdivision?: string;

  /**
   * Request IP
   */
  ip?: string;

  /**
   * Request IP version
   */
  ip_version?: number;

  /**
   * Complete database result
   */
  data?: unknown;
}

/**
 * Location lookup response
 */
interface LookupResponse {
  /**
   * Error (if any) encountered during IP lookup
   */
  error: string | null;

  /**
   * GeoIP API response
   */
  geoIpApiResponse: GeoIpApiResponse | null;
}

class GwaServer {
  private log_: GwaLog;
  private cors_: GwaCors;
  private enabledOutputs_: string[];
  private prettyOutput_: boolean;
  private db_: GwaDb;
  private port_: number;
  private getHeaders_: {[header: string]: string | null};
  private getPaths_: string[];
  private server_?: Server;
  private express_: express.Express;

  /**
   * @param options User options that should overlay default options
   */
  constructor(options: AppOptions) {
    this.log_ = new GwaLog(options.logLevel);
    this.log_.debug(`[${LOG_TAG}] Application options applied:\n`, options);
    this.cors_ = new GwaCors(options.cors, this.log_);
    this.enabledOutputs_ = typedKeys(options.enabledOutputs).filter(
      (output) => options.enabledOutputs[output]
    );
    this.prettyOutput_ = options.prettyOutput;
    this.db_ = new GwaDb(getDbOptions(options), this.enabledOutputs_, this.log_);
    this.port_ = options.port || 3000;
    this.getHeaders_ = options.getHeaders || {};
    this.getPaths_ = options.getPaths;
    this.server_ = undefined;
    this.express_ = express();
    this.beforeListen();
  }

  /**
   * Apply custom Epxress settings and middleware before starting listeners
   */
  private beforeListen(): void {
    // Trust leftmost IP in X-Forwarded-For request header
    // https://expressjs.com/en/guide/behind-proxies.html
    this.express_.set('trust proxy', true);

    if (this.prettyOutput_) {
      this.express_.set('json spaces', 2);
    }

    const getHeadersKeys = Object.keys(this.getHeaders_);

    const xPoweredBy = getHeadersKeys.find((h) => /^x-powered-by$/i.test(h));
    if (xPoweredBy) {
      if (this.getHeaders_[xPoweredBy] === null) {
        this.express_.disable('x-powered-by');
        delete this.getHeaders_[xPoweredBy];
      }
    }

    const etag = getHeadersKeys.find((h) => /^etag$/i.test(h));
    if (etag) {
      const etagValue = this.getHeaders_[etag];
      if (etagValue === null) {
        this.express_.disable('etag');
      } else if (/^strong|weak$/i.test(etagValue)) {
        this.express_.set(etag, etagValue.toLowerCase());
      }
      delete this.getHeaders_[etag];
    }

    // Do not add middleware if not necessary
    if (!Object.keys(this.getHeaders_).length) {
      return;
    }

    const removeHeaders = Object.keys(this.getHeaders_).filter((h) => this.getHeaders_[h] === null);
    removeHeaders.forEach((h) => {
      delete this.getHeaders_[h];
    });

    this.express_.use((req, res, next) => {
      removeHeaders.forEach((h) => {
        res.removeHeader(h);
      });
      res.set(this.getHeaders_);
      next();
    });
  }

  /**
   * Handle Express GET event
   * @param req Express Request object
   * @param res Express Response object
   */
  private async handleGet(req: express.Request, res: express.Response): Promise<void> {
    this.log_.debug(`[${LOG_TAG}] Looking up IP: ${req.ip}`);
    let geoIpApiResponse: GeoIpApiResponse | null = null;

    try {
      const ipLookup = await this.db_.lookup(req.ip);
      if (!ipLookup.error) {
        geoIpApiResponse = ipLookup.geoIpApiResponse;
      } else {
        this.log_.error(`[${LOG_TAG}] Failed to lookup IP\n`, ipLookup.error);
      }
    } catch (ex) {
      this.log_.error(`[${LOG_TAG}] DB lookup encountered an exception\n`, ex);
    }

    // Make sure a response body is available
    if (!geoIpApiResponse) {
      geoIpApiResponse = this.db_.geoIpApiResponse(null, null, null);
    }

    // Set CORS headers
    const corsHeaders = this.cors_.getCorsHeaders(req.get('origin'));
    if (corsHeaders) {
      res.set(corsHeaders);
    }

    res.json(geoIpApiResponse);
  }

  /**
   * Initialize Express server and start listeners
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server_) {
        this.log_.debug(`[${LOG_TAG}] Server appears to be running already`);
        return resolve();
      }

      // Allow any path, proxy should forward only relevant requests
      this.express_.get(this.getPaths_, (req, res) => {
        this.handleGet(req, res).catch((err) => {
          this.log_.error(`[${LOG_TAG}] GET handler encountered an exception\n`, err);
        });
      });
      this.server_ = this.express_.listen(this.port_, () => {
        this.log_.info(`[${LOG_TAG}] Listening at http://localhost:${this.port_}`);
        resolve();
      });
    });
  }

  /**
   * Stop Express server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server_) {
        this.log_.debug(`[${LOG_TAG}] Server does not appear to be running`);
        return resolve();
      }

      this.server_.close(() => {
        this.log_.info(`[${LOG_TAG}] Stopped listening at http://localhost:${this.port_}`);

        this.server_ = undefined;

        resolve();
      });
    });
  }

  /**
   * Check whether Express server is running
   */
  isRunning(): boolean {
    return this.server_ !== undefined;
  }
}

export {GwaServer, GeoIpApiResponse, LookupResponse};
