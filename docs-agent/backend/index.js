require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3002;

const groq = new Groq({
    apiKey: process.env.GROQ_APP_API_KEY,
});

app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.3-70b-versatile',
        });

        res.json({ response: chatCompletion.choices[0]?.message?.content || 'No response generated.' });
    } catch (error) {
        console.error('Groq Error:', error);
        res.status(500).json({ error: 'Failed to generate response from Groq' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
