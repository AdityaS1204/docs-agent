const express = require('express');
const router = express.Router();
const { generateSection } = require('../llm/llmClient');
const { jobStore } = require('../state/jobStore');

/**
 * GET /section/:jobId/:index
 * Generates a single section for an iterative document job.
 * The frontend calls this once per section, in sequence.
 */
router.get('/:jobId/:index', async (req, res) => {
    const { jobId, index } = req.params;
    const sectionIndex = parseInt(index, 10);

    const job = jobStore.get(jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found. It may have expired.' });
    }

    const section = job.sections[sectionIndex];
    if (!section) {
        return res.status(404).json({ error: `Section index ${sectionIndex} not found in job.` });
    }

    try {
        console.log(`📝 [Job ${jobId}] Generating section ${sectionIndex + 1}/${job.sections.length}: "${section.title}"`);

        const docContext = { title: job.title, format: job.format };
        const priorSummary = job.priorSummary || '';

        const sectionData = await generateSection(section, docContext, priorSummary);

        // Update the rolling summary in the job store for the next section
        const sectionText = (sectionData.blocks || [])
            .filter(b => b.content && b.type !== 'table')
            .slice(0, 2)
            .map(b => b.content?.substring(0, 150) + '...')
            .join(' ');
        job.priorSummary = (job.priorSummary || '') + `\n[${section.title}]: ${sectionText}`;

        console.log(`  ✅ Section "${section.title}" done (${sectionData.blocks?.length || 0} blocks)`);

        res.json({
            section_id: section.section_id,
            title: section.title,
            index: sectionIndex,
            total: job.sections.length,
            blocks: sectionData.blocks || []
        });

    } catch (error) {
        console.error(`Section Generation Error [${jobId}/${sectionIndex}]:`, error);
        res.status(500).json({ error: 'Failed to generate section', details: error.message });
    }
});

module.exports = router;
