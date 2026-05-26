const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Verify environment before starting
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be set in environment variables (min 32 chars)');
    process.exit(1);
}

// Init DB & Services
const { prisma } = require('./lib/db');
const whatsappService = require('./services/whatsappService');
const cron = require('node-cron');

// Import Routes
const authRouter = require('./routes/auth');
const patientsRouter = require('./routes/patients');
const appointmentsRouter = require('./routes/appointments');
const doctorsRouter = require('./routes/doctors');
const clinicalRouter = require('./routes/clinical');
const financeRouter = require('./routes/finance');
const servicesRouter = require('./routes/services');
const whatsappRouter = require('./routes/whatsapp');
const cronRouter = require('./routes/cron');
const aiRouter = require('./routes/ai');
const agendaRouter = require('./routes/agenda');
const systemUsersRouter = require('./routes/system-users');
const auditRouter = require('./routes/audit');
const gmailRouter = require('./routes/gmail');
const remindersRouter = require('./routes/reminders');
const prescriptionsRouter = require('./routes/prescriptions');
const templatesRouter = require('./routes/templates');
const { scheduleRouter, durationsRouter } = require('./routes/schedule');
const analyticsRouter = require('./routes/analytics');
const signRouter = require('./routes/sign');

const { errorHandler } = require('./lib/errors');

const app = express();

// --- CORS & Body Parsing ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,https://controlmed.vercel.app')
    .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Permitimos localhost, dominios configurados y cualquier preview/producción de Vercel
        if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('vercel.app')) {
            return callback(null, true);
        }
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
}));

app.use(express.json({ limit: '50mb' }));

// --- Rate Limiting ---
app.set('trust proxy', 1); // Confía en proxies de Vercel (evita error en express-rate-limit)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// --- Cache-Control ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

// --- Public Routes & Special Auth ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use('/api/cron', cronRouter); // Cron handles its own CRON_SECRET auth
app.use('/api/auth/login', loginLimiter); // Rate limiting for login
app.use('/api/sign', signRouter); // Public — no auth required for tablet signing

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
    // Cuando usamos app.use('/api', ...), req.path pierde el prefijo '/api'
    const PUBLIC_PATHS = ['/auth/login', '/health', '/gmail/callback'];
    if (PUBLIC_PATHS.includes(req.path) || req.path.startsWith('/cron/')) return next();

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado: token requerido.' });
    }

    try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role };
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
};

app.use('/api', authMiddleware);

// --- Mounted APIs ---
app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/patients', prescriptionsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/doctor-schedules', scheduleRouter);
app.use('/api/schedule/durations', durationsRouter);
app.use('/api', clinicalRouter); 
app.use('/api/finance', financeRouter);
app.use('/api/payments', financeRouter);
app.use('/api/invoices', financeRouter);
app.use('/api', financeRouter);
app.use('/api/services', servicesRouter);
app.use('/api/fix-services', servicesRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api', agendaRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/system-users', systemUsersRouter);
app.use('/api/audit', auditRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api', templatesRouter);

// --- Initialization ---
if (!process.env.DEMO_RESET_SECRET) {
  whatsappService.initialize();
} else {
  console.log('🧪 Demo mode: WhatsApp desactivado');
}

// --- Nightly Liquidation Reconciliation (02:30 Europe/Madrid) ----------------
// Automatically repairs any appointments that were paid but missed a Liquidation
// row (e.g. doctor was null at payment time, wallet payment, network failure).
cron.schedule('30 2 * * *', async () => {
    try {
        const { runReconciliation } = require('./jobs/reconcileLiquidations');
        console.log('[CRON] Nightly liquidation reconciliation starting…');
        const result = await runReconciliation({ lookbackDays: 60 });
        console.log(`[CRON] Reconciliation done — created: ${result.created}, errors: ${result.errors.length}`);
    } catch (e) {
        console.error('[CRON] Reconciliation failed:', e.message);
    }
}, { timezone: 'Europe/Madrid' });

// --- Demo Reset Endpoint (only active when DEMO_RESET_SECRET is set) ---
if (process.env.DEMO_RESET_SECRET) {
  const demoRouter = require('./routes/demo');
  app.use('/api/demo', demoRouter);
  console.log('🧪 Demo reset endpoint activo en /api/demo/reset');
}

// --- Error Handler ---
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Servidor backend en puerto ${PORT}`);
    });
}
