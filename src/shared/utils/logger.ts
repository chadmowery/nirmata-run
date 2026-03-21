/**
 * A consistent, structured logging utility for the application.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) return;
    console.debug(this.formatMessage('DEBUG', message), ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(this.formatMessage('INFO', message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('WARN', message), ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('ERROR', message), ...args);
  }
}

export const logger = new Logger();
