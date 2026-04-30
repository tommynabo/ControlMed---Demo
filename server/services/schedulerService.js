// ⚠️  DEPRECATED — node-cron is incompatible with Vercel Serverless.
// All scheduled logic is now driven by HTTP endpoints in server/routes/cron.js
// called from an external cron service (e.g. cron-job.org / Vercel Crons).
// This file is kept as a no-op stub to avoid breaking any stale requires.

const startScheduler = (_prisma) => {
    console.log('[Scheduler] node-cron disabled on Serverless. Use HTTP cron endpoints in /api/cron/* instead.');
};

module.exports = { startScheduler };
