enum LogLevel {
  OFF,
  ERROR,
  WARN,
  INFO,
  DEBUG,
}

class GwaLog {
  private level_: LogLevel;

  /**
   * @param level Log level
   */
  constructor(level?: LogLevel) {
    this.level_ = level !== undefined ? level : LogLevel.INFO;
  }

  /**
   * Log debug message
   * @param args Arguments for console.debug
   */
  debug(...args: any[]): void {
    if (this.level_ >= LogLevel.DEBUG) {
      console.debug(...args);
    }
  }

  /**
   * Log info message
   * @param args Arguments for console.info
   */
  info(...args: any[]): void {
    if (this.level_ >= LogLevel.INFO) {
      console.log(...args);
    }
  }

  /**
   * Log warning message
   * @param args Arguments for console.warn
   */
  warn(...args: any[]): void {
    if (this.level_ >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  /**
   * Log error message
   * @param args Arguments for console.error
   */
  error(...args: any[]): void {
    if (this.level_ >= LogLevel.ERROR) {
      console.error(...args);
    }
  }

  /**
   * Set log level
   * @param {LogLevel} level Log level
   */
  setLevel(level: LogLevel): void {
    this.level_ = level;
  }
}

export {GwaLog, LogLevel};
