import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logger = winston.createLogger({
  level: 'info', // Use simple default instead of config dependency
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'vibe-coder-host' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      ),
    }),
  ],
});

// Add file logging in production - use /app/logs instead of workspace logs
if (process.env.NODE_ENV === 'production') {
  const logDir = '/app/logs';
  
  // Ensure log directory exists and is writable
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
      })
    );
    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
      })
    );
  } catch (error) {
    console.warn('Could not create log files, using console logging only:', error);
  }
}

export default logger;