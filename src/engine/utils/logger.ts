/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventOriginContext } from './event-context';

/**
 * A consistent, structured logging utility for the application.
 * Supports categories, metadata, origin tagging, and themed styling.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const COLORS = {
  DEBUG: '#00ced1', // Cyber Teal
  INFO: '#39ff14', // Neural Green
  WARN: '#ffbf00', // Fluorescent Amber
  ERROR: '#ff0055', // Intense Pink
  SERVER: '#bf00ff', // Deep Purple
};

const ANSI_COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m', // Green
  WARN: '\x1b[33m', // Yellow
  ERROR: '\x1b[31m', // Red
  SERVER: '\x1b[35m', // Magenta
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
};

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private getOriginTag(): string {
    return EventOriginContext.current.toUpperCase();
  }

  private log(level: LogLevel, message: string, category?: string, ...args: any[]): void {
    if (level === 'DEBUG' && this.isProduction) return;

    const timestamp = this.getTimestamp();
    const origin = this.getOriginTag();
    const catText = category ? `[${category}] ` : '';
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
      const color = COLORS[level];
      const originBg = origin === 'SERVER' ? COLORS.SERVER : '#444';

      console.log(
        `%c ${origin} %c %c${level}%c %c${timestamp}%c %c${catText}%c`,
        `background: ${originBg}; color: white; padding: 1px 3px; border-radius: 2px; font-size: 10px; font-weight: bold;`,
        '',
        `color: ${color}; font-weight: bold;`,
        '',
        `color: #666; font-size: 10px;`,
        '',
        `color: ${color}; font-weight: bold;`,
        `color: ${level === 'ERROR' || level === 'WARN' ? color : 'inherit'};`,
        message,
        ...args,
      );
    } else {
      // Server-side (Node.js) - ANSI formatting
      const colorCode = ANSI_COLORS[level];
      const originCode = origin === 'SERVER' ? ANSI_COLORS.SERVER : ANSI_COLORS.DIM;
      const reset = ANSI_COLORS.RESET;
      const dim = ANSI_COLORS.DIM;
      const bold = ANSI_COLORS.BOLD;

      const prefix = `${originCode}[${origin}]${reset} ${colorCode}[${level}]${reset} ${dim}[${timestamp}]${reset} ${
        category ? `${bold}[${category}]${reset} ` : ''
      }`;
      const msgColor = level === 'ERROR' || level === 'WARN' ? colorCode : '';

      const output = `${prefix}${msgColor}${message}${reset}`;

      switch (level) {
        case 'DEBUG':
          console.debug(output, ...args);
          break;
        case 'INFO':
          console.info(output, ...args);
          break;
        case 'WARN':
          console.warn(output, ...args);
          break;
        case 'ERROR':
          console.error(output, ...args);
          break;
      }
    }
  }

  debug(message: string, category?: string, ...args: any[]): void {
    this.log('DEBUG', message, category, ...args);
  }

  info(message: string, category?: string, ...args: any[]): void {
    this.log('INFO', message, category, ...args);
  }

  warn(message: string, category?: string, ...args: any[]): void {
    this.log('WARN', message, category, ...args);
  }

  error(message: string, category?: string, ...args: any[]): void {
    this.log('ERROR', message, category, ...args);
  }

  /**
   * Displays a table of data (e.g. for entity queries or component stores).
   * Stripped in production.
   */
  table(data: any, category?: string): void {
    if (this.isProduction) return;

    const origin = this.getOriginTag();
    const catText = category ? `[${category}] ` : '';

    if (typeof window !== 'undefined') {
      const originBg = origin === 'SERVER' ? COLORS.SERVER : '#444';
      console.log(
        `%c ${origin} %c ${catText}TABLE DATA:`,
        `background: ${originBg}; color: white; padding: 1px 3px; border-radius: 2px; font-size: 10px; font-weight: bold;`,
        '',
      );
    } else {
      const originCode = origin === 'SERVER' ? ANSI_COLORS.SERVER : ANSI_COLORS.DIM;
      const reset = ANSI_COLORS.RESET;
      console.log(`${originCode}[${origin}]${reset} ${catText}TABLE DATA:`);
    }
    console.table(data);
  }

  /**
   * Helper for logging entity-related messages with automatic formatting.
   */
  entity(
    entityId: number,
    message: string,
    category: string = 'ECS',
    level: LogLevel = 'INFO',
    ...args: any[]
  ): void {
    this.log(level, `(Entity:${entityId}) ${message}`, category, ...args);
  }
}

export const logger = new Logger();

