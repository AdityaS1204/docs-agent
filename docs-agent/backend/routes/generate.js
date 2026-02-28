const express = require('express');
const router = express.Router();
const { handleCreate } = require('../executor');
const { handleIterativeCreate } = require('../executor/iterativeExecutor');
const { handleSectionEdit } = require('../executor/editExecutor');
const { isIterativeType } = require('../schema/iterativeSchema');
const { getChatHistory, appendToHistory } = require('../state/chatStore');

router.post('/', async (req, res) => {
    const { prompt, docType, docId, operationMode, email } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!email) {
        return res.status(400).json({ error: 'User email is required for authentication' });
    }

    try {
        const type = docType || 'general';
        let chatHistory = [];

        // If frontend provides a docId, maintain conversation state
        if (docId) {
            await appendToHistory(docId, email, "user", prompt);
            chatHistory = await getChatHistory(docId, email);

            // Exclude the very last message we just pushed, as the LLM Client 
            // will append the final user prompt itself with formatting.
            chatHistory = chatHistory.slice(0, -1);
        }

        if (operationMode === 'edit') {
            const response = await handleSectionEdit(prompt, type, docId, email, chatHistory);
            res.json(response);
            return;
        }

        if (isIterativeType(type)) {
            console.log(`Using ITERATIVE mode for: ${type}`);
            const response = await handleIterativeCreate(prompt, type, docId, email, chatHistory);
            res.json(response);
        } else {
            console.log(`Using SINGLE-SHOT mode for: ${type}`);
            const response = await handleCreate(prompt, type, docId, email, chatHistory);
            res.json(response);
        }
    } catch (error) {
        console.error('Generate Route Error:', error);
        res.status(500).json({ error: 'Failed to generate response', details: error.message });
    }
});

module.exports = router;
