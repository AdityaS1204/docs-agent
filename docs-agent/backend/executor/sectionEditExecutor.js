const { getSectionEditCompletion } = require('../llm/llmClient');
const { getChatHistory } = require('../state/chatStore');

/**
 * SECTION EDIT EXECUTOR
 * =====================
 * Handles rewriting a specific section based on its current live content and a user instruction.
 */
async function handleSectionEdit(docId, blockId, userInstruction, currentContent, docType, email) {
    console.log(`\nSECTION EDIT: ${blockId}`);
    console.log(`Instruction: ${userInstruction}`);

    // Fetch outline context from history to give LLM better global context
    const chatHistory = await getChatHistory(docId, email);

    // Call LLM
    console.log('Generating replacement blocks...');
    const result = await getSectionEditCompletion(userInstruction, docType, chatHistory, currentContent, blockId);

    if (!result || !result.blocks) {
        throw new Error('LLM failed to generate a valid section edit response.');
    }

    console.log(`Edit generated: ${result.blocks.length} blocks replaced.`);

    return result; // contains { target_section_id, blocks }
}

module.exports = { handleSectionEdit };
