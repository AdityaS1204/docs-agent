require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { DEFAULT_PORT } = require('./config/constants');

const generateRoute = require('./routes/generate');
const editRoute = require('./routes/edit');
const syncRoute = require('./routes/sync');

const app = express();
const port = process.env.PORT || DEFAULT_PORT;

app.use(cors());
app.use(express.json());

// Routes
app.use('/generate', generateRoute);
app.use('/edit', editRoute);
app.use('/sync', syncRoute);

app.get('/', (req, res) => {
    res.send('Docs Agent API is running.');
});

app.listen(port, () => {
    console.log(`Docs Agent Backend running on port ${port}`);
});
