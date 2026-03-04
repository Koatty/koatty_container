import { DefaultLogger as logger } from "koatty_logger";

const IS_DEBUG = process.env.KOATTY_DEBUG === 'true' || 
                 process.env.NODE_ENV === 'development';

/**
 * Conditional debug log that avoids string concatenation cost in production.
 * @param msgFn - Lazy message function, only called when debug is enabled
 */
export function debugLog(msgFn: () => string): void {
  if (IS_DEBUG) {
    logger.Debug(msgFn());
  }
}
