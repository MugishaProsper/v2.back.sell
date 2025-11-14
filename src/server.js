import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.use('/', (req, res) => {
    return res.json({
        message : "API is running"
    })
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})