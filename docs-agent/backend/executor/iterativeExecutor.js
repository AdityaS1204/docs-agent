/**
 * ITERATIVE EXECUTOR
 * ==================
 * Phase 1 only: generates the document outline and stores the job.
 * Section generation is handled by /section/:jobId/:index endpoint.
 */

const { getOutline } = require('../llm/llmClient');
const { createJob } = require('../state/jobStore');
const { v4: uuidv4 } = require('uuid');

async function handleIterativeCreate(userPrompt, docType) {
    console.log(`\n🔄 ITERATIVE MODE: ${docType.toUpperCase()}`);
    console.log(`📝 Prompt: ${userPrompt}\n`);

    // ── PHASE 1: Generate outline only ──
    console.log('📋 Generating outline...');
    const outline = await getOutline(userPrompt, docType);
    const { title, format, page_setup, default_style, options, sections } = outline;

    console.log(`✅ Outline ready: "${title}" with ${sections.length} sections`);

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
