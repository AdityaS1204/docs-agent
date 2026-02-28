/**
 * CHAT STORE (Supabase Persistent Postgres Memory)
 * ==========
 * In-database store for maintaining conversation history.
 * Multi-tenant safe: Maps chat histories by `user_id` -> `doc_id`.
 */

const { supabase } = require('./supabaseClient');

/**
 * Helper to get the UUID of a user by their Google Email.
 * Auto-creates the user if they don't exist in the database yet.
 * @param {string} email
 * @returns {string} The UUID for the user
 */
async function getOrCreateUser(email) {
    if (!supabase) throw new Error("Supabase is not configured.");
    if (!email) throw new Error("Email is required for multi-tenant memory mapping.");

    // Check if user exists
    const { data: user, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (user && user.id) return user.id;

    // Create if new
    const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ email })
        .select('id')
        .single();

    if (insertError) throw new Error("Failed to create user: " + insertError.message);
    return newUser.id;
}

/**
 * Retrieves the chat history for a specific user & document.
 * @returns {Array} List of message objects [{ role, content }]
 */
async function getChatHistory(docId, email) {
    if (!supabase) return [];

    try {
        const userId = await getOrCreateUser(email);

        const { data, error } = await supabase
            .from('conversations')
            .select('role, content')
            .eq('doc_id', docId)
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching chat history:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error in getChatHistory:', err);
        return [];
    }
}

/**
 * Appends a message to the chat history of a document.
 */
async function appendToHistory(docId, email, role, content) {
    if (!supabase) {
        console.warn('Supabase not configured. Memory skipped.');
        return;
    }

    try {
        const userId = await getOrCreateUser(email);

        const { error } = await supabase
            .from('conversations')
            .insert({
                user_id: userId,
                doc_id: docId,
                role: role,
                content: content
            });

        if (error) console.error('Error saving message to Supabase:', error.message);
    } catch (err) {
        console.error('Error in appendToHistory:', err);
    }
}

/**
 * Clears the chat history for a specific user's document.
 */
async function clearChatHistory(docId, email) {
    if (!supabase) return;

    try {
        const userId = await getOrCreateUser(email);

        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('doc_id', docId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error clearing memory:', error.message);
        } else {
            console.log(`🧹 Cleared database history for document: ${docId} (User: ${email})`);
        }
    } catch (err) {
        console.error('Error in clearChatHistory:', err);
    }
}

module.exports = {
    getChatHistory,
    appendToHistory,
    clearChatHistory
};
