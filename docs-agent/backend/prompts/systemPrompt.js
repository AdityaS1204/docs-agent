const { RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT_INSTRUCTIONS } = require('../schema/documentSchema');

const SYSTEM_PROMPT = `
${SYSTEM_PROMPT_INSTRUCTIONS}

## JSON RESPONSE SCHEMA (STRICT)
The response must follow this strict JSON Schema:
${JSON.stringify(RESPONSE_JSON_SCHEMA, null, 2)}
`;

module.exports = SYSTEM_PROMPT;
