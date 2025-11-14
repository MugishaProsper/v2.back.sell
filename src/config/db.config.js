import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import logger from "./logger";

configDotenv();

export const connectToDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI).then(() => {
            logger.info("Connected to MongoDB");
        })
    } catch (error) {
        logger.error("Error connecting to database: ", error.message);
        return
    }
}