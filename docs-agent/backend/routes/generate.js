const express = require('express');
const router = express.Router();
const { handleCreate } = require('../executor');
const { handleIterativeCreate } = require('../executor/iterativeExecutor');
const { isIterativeType } = require('../schema/iterativeSchema');
const { getChatHistory, appendToHistory } = require('../state/chatStore');

router.post('/', async (req, res) => {
    const { prompt, docType, docId } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const type = docType || 'general';
        let chatHistory = [];

        // If frontend provides a docId, maintain conversation state
        if (docId) {
            appendToHistory(docId, "user", prompt);
            chatHistory = getChatHistory(docId);

            // Exclude the very last message we just pushed, as the LLM Client 
            // will append the final user prompt itself with formatting.
            chatHistory = chatHistory.slice(0, -1);
        }

        if (isIterativeType(type)) {
            console.log(`🔄 Using ITERATIVE mode for: ${type}`);
            const response = await handleIterativeCreate(prompt, type, docId, chatHistory);
            res.json(response);
        } else {
            console.log(`⚡ Using SINGLE-SHOT mode for: ${type}`);
            const response = await handleCreate(prompt, type, docId, chatHistory);
            res.json(response);
        }
    } catch (error) {
        console.error('Generate Route Error:', error);
        res.status(500).json({ error: 'Failed to generate response', details: error.message });
    }
});

module.exports = router;
