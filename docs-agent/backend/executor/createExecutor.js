const { getCompletion } = require('../llm/llmClient');
const { CREATE_PROMPT } = require('../prompts/operationPrompts');
const { appendToHistory } = require('../state/chatStore');

async function handleCreate(userPrompt, docType, docId, email, chatHistory = []) {
    console.log(`\n⚡ CREATE MODE: ${docType.toUpperCase()} `);
    console.log(`📝 Prompt: ${userPrompt} \n`);

    console.log('📋 Requesting generation from LLM...');
    const result = await getCompletion(userPrompt, docType, chatHistory);

    if (docId) {
        // Save the full document response back to history for reference
        await appendToHistory(docId, email, "assistant", JSON.stringify(result));
    }

    return result;
}

module.exports = {
    handleCreate
};
