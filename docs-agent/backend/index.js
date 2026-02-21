const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Docs Agent Backend is running!');
});

app.post('/api/process', (req, res) => {
    const { prompt } = req.body;
    console.log('Received prompt:', prompt);

    const responseText = `You asked: "${prompt}". This is a mock response from the backend AI.`;

    res.json({
        message: responseText,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
