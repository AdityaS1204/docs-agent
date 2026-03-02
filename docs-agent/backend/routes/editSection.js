const express = require('express');
const router = express.Router();
const { handleSectionEdit } = require('../executor/sectionEditExecutor');

/**
 * POST /api/docs/edit-section
 * Handles surgical editing of a specific document section.
 */
router.post('/', async (req, res) => {
    const { doc_id, block_id, instruction, current_content, doc_type, email } = req.body;

    if (!doc_id || !block_id || !instruction) {
        return res.status(400).json({
            error: 'missing_fields',
            message: 'doc_id, block_id, and instruction are required.'
        });
    }

    try {
        const result = await handleSectionEdit(
            doc_id,
            block_id,
            instruction,
            current_content,
            doc_type || 'report',
            email
        );

        res.json(result);
    } catch (error) {
        console.error('Edit Section Route Error:', error);
        res.status(500).json({
            error: 'server_error',
            message: error.message
        });
    }
});

module.exports = router;
