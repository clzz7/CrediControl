import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { debtorsRouter } from './routes/debtors.routes.js';
import { loansRouter } from './routes/loans.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Permite qualquer origem dinamicamente (resolve problemas com Vercel)
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

app.use('/api/debtors', debtorsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/dashboard', dashboardRouter);

// ── Serve Frontend em Produção ────────────────────────────────────────────────
// Como o frontend está hospedado na Vercel, o backend serve apenas a API.
if (isProd) {
  app.get('/', (_req, res) => {
    res.json({ message: 'CrediControl API is running. Access the frontend via Vercel.' });
  });
}

// ── 404 + Error handlers ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 CrediControl API rodando na porta ${PORT} [${isProd ? 'PRODUÇÃO' : 'desenvolvimento'}]`);
  if (!isProd) {
    console.log(`   Dashboard: http://localhost:${PORT}/api/dashboard`);
    console.log(`   Devedores: http://localhost:${PORT}/api/debtors`);
  }
});

export default app;
