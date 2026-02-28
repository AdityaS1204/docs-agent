/**
 * CHAT STORE
 * ==========
 * In-memory store for maintaining conversation history mapped by Google Doc ID.
 * This provides the LLM with conversational memory and context without
 * sending the entire document body every time.
 */

const chatStore = new Map();

/**
 * Retrieves the chat history for a specific document.
 * @param {string} docId - The Google Document ID
 * @returns {Array} List of message objects { role, content }
 */
function getChatHistory(docId) {
    if (!chatStore.has(docId)) {
        chatStore.set(docId, []);
    }
    return chatStore.get(docId);
}

/**
 * Appends a message to the chat history of a document.
 * @param {string} docId - The Google Document ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - The message content
 */
function appendToHistory(docId, role, content) {
    const history = getChatHistory(docId);
    history.push({ role, content });
    chatStore.set(docId, history);
}

/**
 * Clears the chat history for a specific document.
 * @param {string} docId - The Google Document ID
 */
function clearChatHistory(docId) {
    chatStore.delete(docId);
    console.log(`🧹 Cleared chat history for document: ${docId}`);
}

module.exports = {
    getChatHistory,
    appendToHistory,
    clearChatHistory
};
