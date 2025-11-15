import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf, colorize, errors, json, metadata }  = format;

// Custom format for console output (human-readable)
const consoleFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
  let log = `${timestamp} [${level}]`;
  
  if (requestId) {
    log += ` [${requestId}]`;
  }
  
  log += `: ${message}`;
  
  // Add metadata if present
  const metaKeys = Object.keys(meta);
  if (metaKeys.length > 0 && meta.metadata) {
    log += ` ${JSON.stringify(meta.metadata)}`;
  } else if (metaKeys.length > 0) {
    const filteredMeta = { ...meta };
    delete filteredMeta.level;
    delete filteredMeta.message;
    delete filteredMeta.timestamp;
    if (Object.keys(filteredMeta).length > 0) {
      log += ` ${JSON.stringify(filteredMeta)}`;
    }
  }
  
  return log;
});

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger with structured JSON logging
const logger = createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }), // Include stack traces for errors
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
  ),
  defaultMeta: {
    service: 'ai-auction-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport with colorized output for development
    new transports.Console({
      format: combine(
        colorize(),
        consoleFormat
      )
    }),
    // File transport with JSON format for structured logging
    new transports.File({ 
      filename: "logs/app.log",
      format: combine(
        json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Separate file for errors only
    new transports.File({ 
      filename: "logs/error.log",
      level: 'error',
      format: combine(
        json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: 'logs/exceptions.log',
      format: combine(
        json()
      )
    })
  ],
  rejectionHandlers: [
    new transports.File({ 
      filename: 'logs/rejections.log',
      format: combine(
        json()
      )
    })
  ]
});

// Add stream for Morgan HTTP logging integration
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

export default logger