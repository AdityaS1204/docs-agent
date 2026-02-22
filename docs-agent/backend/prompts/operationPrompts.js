module.exports = {
    CREATE_PROMPT: (userInput) => `Draft a new document based on: ${userInput}`,
    PATCH_PROMPT: (originalText, instruction) => `Modify the following text: "${originalText}" based on this instruction: "${instruction}"`,
    INSERT_PROMPT: (context, instruction) => `Insert new content near: "${context}" following this instruction: "${instruction}"`
};
