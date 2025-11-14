import logger from "../config/logger.js";

const loggerMiddleware = (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
};

export default loggerMiddleware