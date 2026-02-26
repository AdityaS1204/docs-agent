const express = require('express');
const router = express.Router();
const documentState = require('../state/documentState');

router.post('/', async (req, res) => {
    const { state } = req.body;
    documentState.updateState(state);
    res.json({ status: 'success' });
});

module.exports = router;
