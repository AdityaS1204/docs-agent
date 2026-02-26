const { getCompletion } = require('../llm/llmClient');
const { CREATE_PROMPT } = require('../prompts/operationPrompts');

async function handleCreate(userInput, docType) {
    const prompt = CREATE_PROMPT(userInput);
    const actions = await getCompletion(prompt, docType);
    return actions;
}

module.exports = {
    handleCreate
};
