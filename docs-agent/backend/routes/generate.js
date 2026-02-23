const express = require('express');
const router = express.Router();
const { handleCreate } = require('../executor');

router.post('/', async (req, res) => {
    const { prompt, docType } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await handleCreate(prompt, docType);
        res.json(response);
    } catch (error) {
        console.error('Generate Route Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

module.exports = router;
