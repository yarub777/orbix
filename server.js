import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json({ limit: '1mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_PATH = path.join(DATA_DIR, 'orders.json');

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_PATH)) fs.writeFileSync(ORDERS_PATH, JSON.stringify({ orders: [] }, null, 2));
}

function readOrders() {
  ensureData();
  const raw = fs.readFileSync(ORDERS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeOrders(data) {
  ensureData();
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(data, null, 2));
}

function moneyToNumber(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function generateCode() {
  return 'ORD-' + String(Math.floor(100000 + Math.random() * 899999));
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/checkout', (req, res) => {
  try {
    const body = req.body || {};

    const required = ['name', 'email', 'address', 'city', 'zip', 'method'];
    const missing = required.filter((k) => {
      const v = body[k];
      return typeof v !== 'string' || !v.trim();
    });

    if (missing.length) {
      return res.status(400).json({ error: 'MISSING_FIELDS', missing });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const totals = body.totals || {};

    const order = {
      code: generateCode(),
      createdAt: new Date().toISOString(),
      customer: {
        name: body.name,
        email: body.email,
        address: body.address,
        city: body.city,
        zip: body.zip,
        country: typeof body.country === 'string' ? body.country : undefined,
      },
      payment: {
        method: body.method,
        providerRef: body.providerRef || undefined,
      },
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        qty: Number(it.qty || 0),
        price: moneyToNumber(it.price),
      })),
      totals: {
        subtotal: moneyToNumber(totals.subtotal),
        shipping: moneyToNumber(totals.shipping),
        total: moneyToNumber(totals.total),
      },
      status: 'placed'
    };

    const db = readOrders();
    db.orders.push(order);
    writeOrders(db);

    res.json({ ok: true, code: order.code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

