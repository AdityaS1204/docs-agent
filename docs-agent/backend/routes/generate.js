const express = require('express');
const router = express.Router();
const { handleCreate } = require('../executor');
const { handleIterativeCreate } = require('../executor/iterativeExecutor');
const { isIterativeType } = require('../schema/iterativeSchema');

router.post('/', async (req, res) => {
    const { prompt, docType } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const type = docType || 'general';

        if (isIterativeType(type)) {
            console.log(`🔄 Using ITERATIVE mode for: ${type}`);
            const response = await handleIterativeCreate(prompt, type);
            res.json(response);
        } else {
            console.log(`⚡ Using SINGLE-SHOT mode for: ${type}`);
            const response = await handleCreate(prompt, type);
            res.json(response);
        }
    } catch (error) {
        console.error('Generate Route Error:', error);
        res.status(500).json({ error: 'Failed to generate response', details: error.message });
    }
});

module.exports = router;
