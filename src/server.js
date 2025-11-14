import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import logger from './config/logger.js';
import { connectToDatabase } from './config/db.config.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials : true,
    origin : (origin, callback) => {
        return callback(null, true)
    },
    methods : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}))

app.use('/', (req, res) => {
    return res.json({
        message : "API is running"
    })
});

app.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);
    await connectToDatabase()
})