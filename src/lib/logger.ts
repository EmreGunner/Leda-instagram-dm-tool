/**
 * Structured logging utility for the autonomous scraping system
 * Provides consistent logging with levels and context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: any;
}

class Logger {
    private context: LogContext;

    constructor(context: LogContext = {}) {
        this.context = context;
    }

    private log(level: LogLevel, message: string, data?: LogContext) {
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            level,
            message,
            ...this.context,
            ...data,
        };

        // Console logging with colors
        const colors = {
            debug: '\x1b[36m', // cyan
            info: '\x1b[32m',  // green
            warn: '\x1b[33m',  // yellow
            error: '\x1b[31m', // red
        };
        const reset = '\x1b[0m';

        const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
        const contextStr = Object.keys({ ...this.context, ...data }).length > 0
            ? `\n  ${JSON.stringify({ ...this.context, ...data }, null, 2)}`
            : '';

        console.log(`${prefix} ${timestamp} ${message}${contextStr}`);

        // TODO: Send to database/monitoring service if needed
        // await supabase.from('logs').insert(logData);
    }

    debug(message: string, data?: LogContext) {
        this.log('debug', message, data);
    }

    info(message: string, data?: LogContext) {
        this.log('info', message, data);
    }

    warn(message: string, data?: LogContext) {
        this.log('warn', message, data);
    }

    error(message: string, data?: LogContext) {
        this.log('error', message, data);
    }

    child(additionalContext: LogContext): Logger {
        return new Logger({ ...this.context, ...additionalContext });
    }
}

// Export singleton for general use
export const logger = new Logger();

// Export class for creating loggers with specific context
export default Logger;
