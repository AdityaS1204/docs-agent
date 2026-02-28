/**
 * ITERATIVE EXECUTOR
 * ==================
 * Phase 1 only: generates the document outline and stores the job.
 * Section generation is handled by /section/:jobId/:index endpoint.
 */

const { getOutline } = require('../llm/llmClient');
const { createJob } = require('../state/jobStore');
const { appendToHistory } = require('../state/chatStore');
const { v4: uuidv4 } = require('uuid');

async function handleIterativeCreate(userPrompt, docType, docId = null, chatHistory = []) {
    console.log(`\n🔄 ITERATIVE MODE: ${docType.toUpperCase()}`);
    console.log(`📝 Prompt: ${userPrompt}\n`);

    // ── PHASE 1: Generate outline only ──
    console.log('📋 Generating outline...');
    const outline = await getOutline(userPrompt, docType, chatHistory);
    const { title, format, page_setup, default_style, options, sections } = outline;

    console.log(`✅ Outline ready: "${title}" with ${sections.length} sections`);

    // Context Optimization: Only save the Outline structure to memory, not the massive body text.
    if (docId) {
        const structuralSummary = `Outline Generated: ${title}\nSections:\n` +
            sections.map((s, i) => `${i + 1}. ${s.title} (${s.type}) - ${s.description}`).join('\n');
        appendToHistory(docId, "assistant", structuralSummary);
    }

    // Store the job so /section/:jobId/:index can access outline context
    const jobId = uuidv4();
    createJob(jobId, { title, format, page_setup, default_style, options, sections });

    console.log(`🗂️ Job created: ${jobId}`);

    // Return the lightweight response — sections will be fetched one by one
    return {
        mode: "iterative_start",
        jobId,
        document: { title, format, page_setup, default_style, options },
        sections_meta: sections.map((s, i) => ({
            index: i,
            section_id: s.section_id,
            title: s.title,
            type: s.type
        }))
    };
}

module.exports = { handleIterativeCreate };
