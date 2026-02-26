/**
 * ITERATIVE EXECUTOR
 * ==================
 * Orchestrates long-form document generation in phases:
 * 1. Generate a structured outline (1 LLM call)
 * 2. Generate content for each section (N LLM calls)
 * 3. Return a streaming-friendly response structure
 *
 * The response is a special format the frontend/GAS reads section by section.
 */

const { getOutline, generateSection } = require('../llm/llmClient');

// delay helper to avoid hitting Groq rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DELAY_AFTER_OUTLINE_MS = 2000;  
const DELAY_BETWEEN_SECTIONS_MS = 3000;

async function handleIterativeCreate(userPrompt, docType) {
    console.log(`\n🔄 ITERATIVE MODE: ${docType.toUpperCase()}`);
    console.log(`📝 Prompt: ${userPrompt}\n`);

    // ── PHASE 1: Generate outline ──
    console.log('📋 Phase 1: Generating outline...');
    const outline = await getOutline(userPrompt, docType);
    const { title, format, page_setup, default_style, options, sections } = outline;

    console.log(`✅ Outline ready: "${title}" with ${sections.length} sections`);

    await sleep(DELAY_AFTER_OUTLINE_MS);

    // Build a running summary for context continuity across sections
    let priorSummary = '';
    const sectionResults = [];

    // ── PHASE 2: Generate each section ──
    console.log('\n📝 Phase 2: Generating sections...');
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        console.log(`  [${i + 1}/${sections.length}] Generating: "${section.title}"...`);

        const docContext = { title, format };
        const sectionData = await generateSection(section, docContext, priorSummary);

        sectionResults.push({
            section_id: section.section_id,
            title: section.title,
            blocks: sectionData.blocks || []
        });

        // Update the rolling summary so next section has context
        priorSummary = buildPriorSummary(sectionResults);
        console.log(`  ✅ Section "${section.title}" done (${sectionData.blocks?.length || 0} blocks)`);

        // Respect rate limits — wait before the next section call
        if (i < sections.length - 1) {
            console.log(`  ⏳ Waiting ${DELAY_BETWEEN_SECTIONS_MS / 1000}s before next section...`);
            await sleep(DELAY_BETWEEN_SECTIONS_MS);
        }
    }

    console.log(`\n🎉 All ${sections.length} sections generated!`);

    // ── Return unified response ──
    // This is the special iterative response format the GAS frontend reads
    return {
        mode: "iterative",
        operation: "create",
        document: {
            title,
            format,
            page_setup,
            default_style,
            options
        },
        sections: sectionResults
    };
}

// ──────────────────────────────────────────────
// Build a concise summary of generated sections
// to give the LLM rolling context
// ──────────────────────────────────────────────
function buildPriorSummary(sectionResults) {
    return sectionResults
        .map(s => {
            const textBlocks = (s.blocks || [])
                .filter(b => b.content && b.type !== 'table')
                .slice(0, 2) // Take first 2 text blocks for brevity
                .map(b => b.content?.substring(0, 150) + '...')
                .join(' ');
            return `[${s.title}]: ${textBlocks}`;
        })
        .join('\n');
}

module.exports = {
    handleIterativeCreate
};
