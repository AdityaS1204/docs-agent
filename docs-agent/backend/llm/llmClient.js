const Groq = require('groq-sdk');
const SYSTEM_PROMPT = require('../prompts/systemPrompt');
const { SYSTEM_PROMPT_INSTRUCTIONS } = require('../schema/documentSchema');
const { isIterativeType } = require('../schema/iterativeSchema');
const { MODELS, TOKEN_LIMITS } = require('../config/constants');
const { validateLLMResponse, getJsonSchemaForType } = require('../schema/documentSchema');
const { OUTLINE_SCHEMA, SECTION_SCHEMA } = require('../schema/iterativeSchema');

const groq = new Groq({
    apiKey: process.env.GROQ_APP_API_KEY,
});

// ─────────────────────────────────────────
// Single-shot completion (short-form docs)
// ─────────────────────────────────────────
async function getCompletion(prompt, docType, chatHistory = []) {
    let schemaName = "RESPONSE_SCHEMA";
    let systemPromptBase = "You are a professional document creation AI. " + SYSTEM_PROMPT_INSTRUCTIONS;
    try {
        const schema = getJsonSchemaForType(docType);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPromptBase },
                ...chatHistory,
                { role: "user", content: `Create a ${docType} based on this prompt: ${prompt}` }
            ],
            model: MODELS.GPT_OSS_120B,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "document_response",
                    strict: true,
                    schema: schema
                }
            },
            max_completion_tokens: TOKEN_LIMITS.MAX_COMPLETION_TOKENS
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || '{}';
        let parsed = JSON.parse(rawContent);

        console.log('--- LLM RESPONSE ---');
        console.log(JSON.stringify(parsed, null, 2));
        console.log('--------------------');

        const validation = validateLLMResponse(parsed);
        if (!validation.valid) {
            console.warn('LLM Response Validation Errors:', validation.errors);
        }

        return parsed;
    } catch (error) {
        console.error('LLM Client Error:', error);
        throw error;
    }
}

// ─────────────────────────────────────────
// Phase 1: Generate document outline
// ─────────────────────────────────────────
async function getOutline(userPrompt, docType, chatHistory = []) {
    const systemMsg = `You are a document planning agent. Your job is to generate a structured document outline.
The user wants a ${docType.toUpperCase()} document. 
Create a comprehensive outline with 8 to 12 sections.
Each section must have a clear title, type (intro/body/conclusion/appendix/abstract/references), depth (1-3), and a 1-sentence description of what goes in it.
Return ONLY valid JSON. No markdown. No explanation.`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemMsg },
                ...chatHistory,
                { role: 'user', content: `Create a detailed outline for: ${userPrompt}` },
            ],
            model: MODELS.GPT_OSS_120B,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "document_outline",
                    strict: true,
                    schema: OUTLINE_SCHEMA
                }
            },
            max_completion_tokens: 4096
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawContent);
        console.log('--- OUTLINE GENERATED ---');
        console.log(`Title: ${parsed.title} | Sections: ${parsed.sections?.length}`);
        console.log('-------------------------');
        return parsed;
    } catch (error) {
        console.error('Outline Generation Error:', error);
        throw error;
    }
}

// ─────────────────────────────────────────
// Phase 2: Generate content for one section
// ─────────────────────────────────────────
async function generateSection(sectionMeta, docContext, priorSummary) {
    const systemMsg = `You are a professional document writing agent.
You are writing one section of a ${docContext.format.toUpperCase()} document titled "${docContext.title}".
Writing style: ${getStyleForFormat(docContext.format)}
CRITICAL RULES:
- Write ONLY the content for the section you are given. Do not write other sections.
- Be COMPREHENSIVE and DETAILED. Write long, thorough paragraphs.
- Use appropriate block types (sub_heading, paragraph, bullet_list, table, etc.)
- NEVER use "\\n" inside content strings — use separate blocks instead.
- Assign unique block_ids like "${sectionMeta.section_id}_b1", "${sectionMeta.section_id}_b2", etc.
- Return ONLY valid JSON. No markdown. No explanation.

Prior sections summary (for context continuity):
${priorSummary || 'This is the first section.'}`;

    const userMsg = `Write the "${sectionMeta.title}" section (${sectionMeta.type}).
Section description: ${sectionMeta.description}
Section ID: ${sectionMeta.section_id}`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: userMsg },
            ],
            model: MODELS.GPT_OSS_120B,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "section_content",
                    // strict: false — Groq strict mode requires ALL properties in required[].
                    // Our block schema has optional fields per block type (cells for table,
                    // items for lists, etc.) which is incompatible with strict: true.
                    strict: false,
                    schema: SECTION_SCHEMA
                }
            },
            max_completion_tokens: TOKEN_LIMITS.MAX_COMPLETION_TOKENS
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawContent);
        console.log(`--- SECTION GENERATED: ${sectionMeta.section_id} (${sectionMeta.title}) | Blocks: ${parsed.blocks?.length} ---`);
        return parsed;
    } catch (error) {
        console.error(`Section Generation Error [${sectionMeta.section_id}]:`, error);
        throw error;
    }
}

// ─────────────────────────────────────────
// Helper: Writing style per doc type
// ─────────────────────────────────────────
function getStyleForFormat(format) {
    const styles = {
        thesis: "Academic, formal, first_line_indent, JUSTIFIED alignment, Times New Roman.",
        research_paper: "Academic, evidence-based, formal citations, JUSTIFIED alignment.",
        report: "Professional, structured, use tables and callouts for key findings.",
        article: "Engaging, conversational, LEFT alignment, use callouts for key points.",
        proposal: "Persuasive, professional, include budget/timeline tables.",
        meeting_notes: "Concise, action-oriented, use bullet lists and key_value blocks.",
        legal: "Formal, precise, numbered sections, LEFT alignment.",
        technical_docs: "Technical, precise, use code_block and tables extensively.",
        case_study: "Narrative, evidence-backed, use callouts and tables for data.",
        white_paper: "Authoritative, data-driven, use tables and blockquotes.",
        policy: "Formal, directive tone, use numbered lists for rules.",
        general: "Professional, clear, balanced use of formatting."
    };
    return styles[format] || styles.general;
}

module.exports = {
    getCompletion,
    getOutline,
    generateSection
};
