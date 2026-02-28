const { getSectionEditCompletion } = require('../llm/llmClient');
const { appendToHistory } = require('../state/chatStore');

/**
 * Handles editing an existing section based on user context.
 * Used when Operation Mode = 'edit'.
 */
async function handleSectionEdit(userPrompt, docType, docId, email, chatHistory = []) {
    console.log(`\nEDIT MODE: ${docType.toUpperCase()}`);
    console.log(`Prompt: ${userPrompt}\n`);

    // We don't need to append the user prompt to chatHistory here, 
    // because generate.js already did it before calling this.

    if (!docId) {
        throw new Error('Edit mode requires a document context (docId). Please reload your document to sync it.');
    }

    if (!chatHistory || chatHistory.length === 0) {
        throw new Error('No outline or document context found in memory. Please generate a document first before trying to edit a section.');
    }

    console.log('Requesting section edit from LLM...');
    const result = await getSectionEditCompletion(userPrompt, docType, chatHistory);

    if (!result || !result.target_section_id || !result.blocks) {
        throw new Error('LLM failed to generate a valid section edit response.');
    }

    console.log(`Edit ready for section: "${result.target_section_id}" with ${result.blocks.length} new blocks`);

    // Context Optimization: Save a summary of what the AI changed to memory
    const editSummary = `Edited section '${result.target_section_id}'. Replaced with ${result.blocks.length} blocks.`;
    await appendToHistory(docId, email, "assistant", editSummary);

    return result;
}

module.exports = {
    handleSectionEdit
};
