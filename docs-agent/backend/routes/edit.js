const express = require('express');
const router = express.Router();
const { handlePatch, handleInsert } = require('../executor');

router.post('/', async (req, res) => {
    const { operation, payload } = req.body;

    try {
        let actions = [];
        if (operation === 'patch') {
            actions = await handlePatch(payload.originalText, payload.instruction);
        } else if (operation === 'insert') {
            actions = await handleInsert(payload.context, payload.instruction);
        }

        res.json({ actions });
    } catch (error) {
        console.error('Edit Route Error:', error);
        res.status(500).json({ error: 'Failed to process edit' });
    }
});

module.exports = router;
