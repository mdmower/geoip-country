import {AppOptions, overlayOptions} from './options';
import {GwaServer} from './server';

export default class GeoIpWebApi {
  private _gwaServer: GwaServer;

  /**
   * @param options User options
   */
  constructor(options?: AppOptions) {
    const appOptions = overlayOptions(options);
    this._gwaServer = new GwaServer(appOptions);
  }

  /**
   * Initialize GeoIp Web API and start Express server listeners
   */
  start(): Promise<void> {
    return this._gwaServer.start();
  }

  /**
   * Stop Express server listeners
   */
  stop(): Promise<void> {
    return this._gwaServer.stop();
  }

  /**
   * Determine whether Express server is listening for requests
   */
  isRunning(): boolean {
    return this._gwaServer.isRunning();
  }
}

export {GeoIpWebApi};
