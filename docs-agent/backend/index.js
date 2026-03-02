const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') }); // Fallback if root .env missing
const express = require('express');
const cors = require('cors');
const { DEFAULT_PORT } = require('./config/constants');

const generateRoute = require('./routes/generate');
const editRoute = require('./routes/edit');
const syncRoute = require('./routes/sync');
const sectionRoute = require('./routes/section');
const editSectionRoute = require('./routes/editSection');
const { clearChatHistory } = require('./state/chatStore');

const app = express();
const port = process.env.PORT || DEFAULT_PORT;

app.use(cors());
app.use(express.json());

// Routes
app.use('/generate', generateRoute);
app.use('/edit', editRoute);
app.use('/edit-section', editSectionRoute);
app.use('/sync', syncRoute);
app.use('/section', sectionRoute);

app.get('/', (req, res) => {
    res.send('Docs Agent API is running.');
});

// Clear chat memory for a specific document and user
app.delete('/chat/:docId', async (req, res) => {
    const { docId } = req.params;
    const { email } = req.body; // Sent from frontend

    if (!email) {
        return res.status(400).json({ status: 'error', message: 'User email is required to clear history.' });
    }

    await clearChatHistory(docId, email);
    res.json({ status: 'success' });
});

app.listen(port, () => {
    console.log(`Docs Agent Backend running on port ${port}`);
});
