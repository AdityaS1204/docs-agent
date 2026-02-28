const { getCompletion } = require('../llm/llmClient');
const { CREATE_PROMPT } = require('../prompts/operationPrompts');
const { appendToHistory } = require('../state/chatStore');

async function handleCreate(userInput, docType, docId = null, chatHistory = []) {
    const prompt = CREATE_PROMPT(userInput);
    const actions = await getCompletion(prompt, docType, chatHistory);

    // Context Optimization: For short-form single-shot docs, we save the full response.
    if (docId && actions) {
        appendToHistory(docId, "assistant", JSON.stringify(actions));
    }

    return actions;
}

module.exports = {
    handleCreate
};
