require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { DEFAULT_PORT } = require('./config/constants');

const generateRoute = require('./routes/generate');
const editRoute = require('./routes/edit');
const syncRoute = require('./routes/sync');
const sectionRoute = require('./routes/section');
const { clearChatHistory } = require('./state/chatStore');

const app = express();
const port = process.env.PORT || DEFAULT_PORT;

app.use(cors());
app.use(express.json());

// Routes
app.use('/generate', generateRoute);
app.use('/edit', editRoute);
app.use('/sync', syncRoute);
app.use('/section', sectionRoute);

app.get('/', (req, res) => {
    res.send('Docs Agent API is running.');
});

// Clear chat history endpoint
app.delete('/chat/:docId', (req, res) => {
    const docId = req.params.docId;
    if (!docId) {
        return res.status(400).json({ error: 'Missing docId' });
    }
    clearChatHistory(docId);
    res.json({ status: 'success', message: 'Chat context cleared' });
});

app.listen(port, () => {
    console.log(`Docs Agent Backend running on port ${port}`);
});
