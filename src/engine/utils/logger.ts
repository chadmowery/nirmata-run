/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventOriginContext } from './event-context';

/**
 * A consistent, structured logging utility for the application.
 * Supports categories, metadata, origin tagging, and themed styling.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const COLORS = {
  DEBUG: '#00ced1', // Cyber Teal
  INFO: '#39ff14',  // Neural Green
  WARN: '#ffbf00',  // Fluorescent Amber
  ERROR: '#ff0055', // Intense Pink
  SERVER: '#bf00ff', // Deep Purple
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
        `%c ${origin} %c %c${level}%c %c${timestamp}%c %c${catText}%c${message}`,
        `background: ${originBg}; color: white; padding: 1px 3px; border-radius: 2px; font-size: 10px; font-weight: bold;`,
        '',
        `color: ${color}; font-weight: bold;`,
        '',
        `color: #666; font-size: 10px;`,
        '',
        `color: ${color}; font-weight: bold;`,
        '',
        message,
        ...args
      );
    } else {
      // Server-side (Node.js) - Standard formatting
      const prefix = `[${origin}] [${level}] [${timestamp}] ${catText}`;
      const fullMessage = `${prefix}${message}`;
      
      switch (level) {
        case 'DEBUG':
          console.debug(fullMessage, ...args);
          break;
        case 'INFO':
          console.info(fullMessage, ...args);
          break;
        case 'WARN':
          console.warn(fullMessage, ...args);
          break;
        case 'ERROR':
          console.error(fullMessage, ...args);
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
    
    console.log(`[${origin}] ${catText}TABLE DATA:`);
    console.table(data);
  }

  /**
   * Helper for logging entity-related messages with automatic formatting.
   */
  entity(entityId: number, message: string, category: string = 'ECS', level: LogLevel = 'INFO', ...args: any[]): void {
    this.log(level, `(Entity:${entityId}) ${message}`, category, ...args);
  }
}

export const logger = new Logger();
