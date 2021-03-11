interface DbInterface {
  /**
   * Get database result for IP
   * @param ip IPv4 or IPv6 address to lookup
   */
  get(ip: string): Promise<unknown>;

  /**
   * Get a specific string value from the result of a database search
   * @param dbResult Result of database search
   * @param output Output value to fetch from database
   */
  getStringValue(dbResult: unknown, output: string): string | null;
}

export {DbInterface};
