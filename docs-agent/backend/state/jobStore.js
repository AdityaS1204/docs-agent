/**
 * JOB STORE
 * ==========
 * In-memory store for iterative document generation jobs.
 * Each job holds the outline metadata so /section/:jobId/:index
 * can generate sections independently, one at a time.
 * 
 * Jobs expire after 30 minutes automatically.
 */

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

const jobStore = new Map();

function createJob(jobId, { title, format, page_setup, default_style, options, sections }) {
    const job = {
        jobId,
        title,
        format,
        page_setup,
        default_style,
        options,
        sections,
        priorSummary: '',
        createdAt: Date.now()
    };
    jobStore.set(jobId, job);

    // Auto-expire job after TTL
    setTimeout(() => {
        jobStore.delete(jobId);
        console.log(`🗑️ Job ${jobId} expired and removed from store.`);
    }, JOB_TTL_MS);

    return job;
}

module.exports = { jobStore, createJob };
