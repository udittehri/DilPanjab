const express = require('express');
const fs = require('fs/promises');
const fsNative = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || '1010').trim();
const SOURCE_DB_PATH = path.join(__dirname, 'data', 'db.json');
const TEMP_DB_PATH = path.join('/tmp', 'dilpanjab', 'db.json');
let DB_PATH = SOURCE_DB_PATH;
const DEFAULT_COLLECTION_TIME = '7:00 PM';

let writeQueue = Promise.resolve();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function cleanPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(number.toFixed(2));
}

function cleanQuantity(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 20) return null;
  return number;
}

function cleanDate(value) {
  const dateText = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;

  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return dateText;
}

function cleanImageUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('images/') || /^https?:\/\//i.test(url)) {
    return url;
  }
  return '';
}

async function prepareDbPath() {
  try {
    await fs.access(SOURCE_DB_PATH, fsNative.constants.W_OK);
    DB_PATH = SOURCE_DB_PATH;
    return;
  } catch (error) {
    // Read-only bundle environments (such as Amplify compute) must use /tmp.
  }

  await fs.mkdir(path.dirname(TEMP_DB_PATH), { recursive: true });

  try {
    await fs.access(TEMP_DB_PATH, fsNative.constants.F_OK);
  } catch (error) {
    await fs.copyFile(SOURCE_DB_PATH, TEMP_DB_PATH);
  }

  DB_PATH = TEMP_DB_PATH;
}

async function readDb() {
  const content = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(content);
}

async function writeDb(nextData) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => fs.writeFile(DB_PATH, JSON.stringify(nextData, null, 2)));
  return writeQueue;
}

function requireAdmin(req, res, next) {
  const pin = String(req.get('x-admin-pin') || '').trim();
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'Unauthorized admin request' });
  }
  return next();
}

app.get('/api/public', async (_req, res) => {
  try {
    const db = await readDb();
    const visibleMenu = (db.menu || []).filter((item) => item.available);
    return res.json({
      business: db.business,
      todaysMeal: db.todaysMeal,
      menu: visibleMenu
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to load app data' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const db = await readDb();
    const todaysMeal = db.todaysMeal || {};

    if (!todaysMeal.available) {
      return res.status(400).json({ error: "Today's meal is currently unavailable" });
    }

    const customerName = cleanText(req.body.customerName, 80);
    const phone = cleanText(req.body.phone, 40);
    const pickupDate = cleanDate(req.body.pickupDate);
    const pickupTime = DEFAULT_COLLECTION_TIME;
    const note = cleanText(req.body.note, 300);
    const quantity = cleanQuantity(req.body.quantity);
    const unitPrice = cleanPrice(todaysMeal.price);

    if (!customerName || !phone || !pickupDate || !quantity || unitPrice === null) {
      return res.status(400).json({ error: 'Please provide valid order details' });
    }

    const total = Number((quantity * unitPrice).toFixed(2));

    const order = {
      id: crypto.randomUUID(),
      customerName,
      phone,
      quantity,
      pickupDate,
      pickupTime,
      note,
      mealName: todaysMeal.name,
      unitPrice,
      total,
      status: 'ordered',
      paid: false,
      paymentMode: 'Pay on collection',
      createdAt: new Date().toISOString(),
      collectedAt: null,
      paidAt: null
    };

    db.orders = db.orders || [];
    db.orders.unshift(order);
    await writeDb(db);

    return res.status(201).json({ message: 'Order placed. Pay on collection.', order });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to place order' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const pin = String(req.body.pin || '').trim();
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid admin PIN' });
  }
  return res.json({ ok: true });
});

app.get('/api/admin/data', requireAdmin, async (_req, res) => {
  try {
    const db = await readDb();
    return res.json(db);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to load admin data' });
  }
});

app.put('/api/admin/business', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const name = cleanText(req.body.name, 80);
    const address = cleanText(req.body.address, 250);
    const phone = cleanText(req.body.phone, 40);
    const collectionNote = cleanText(req.body.collectionNote, 200);

    if (!name || !address) {
      return res.status(400).json({ error: 'Business name and address are required' });
    }

    db.business = { name, address, phone, collectionNote };
    await writeDb(db);

    return res.json({ message: 'Business info updated', business: db.business });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update business info' });
  }
});

app.put('/api/admin/today', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const name = cleanText(req.body.name, 120);
    const description = cleanText(req.body.description, 300);
    const price = cleanPrice(req.body.price);
    const available = Boolean(req.body.available);
    const date = cleanText(req.body.date, 30) || new Date().toISOString().slice(0, 10);
    const image = cleanImageUrl(req.body.image);

    if (!name || price === null) {
      return res.status(400).json({ error: 'Meal name and valid price are required' });
    }

    db.todaysMeal = { name, description, price, available, date, image };
    await writeDb(db);

    return res.json({ message: "Today's meal updated", todaysMeal: db.todaysMeal });
  } catch (error) {
    return res.status(500).json({ error: "Unable to update today's meal" });
  }
});

app.post('/api/admin/menu', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const name = cleanText(req.body.name, 120);
    const description = cleanText(req.body.description, 300);
    const price = cleanPrice(req.body.price);
    const image = cleanImageUrl(req.body.image);
    const available = Boolean(req.body.available);

    if (!name || price === null) {
      return res.status(400).json({ error: 'Menu item name and valid price are required' });
    }

    const item = {
      id: crypto.randomUUID(),
      name,
      description,
      price,
      image,
      available
    };

    db.menu = db.menu || [];
    db.menu.push(item);
    await writeDb(db);

    return res.status(201).json({ message: 'Menu item added', item });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to add menu item' });
  }
});

app.put('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const item = (db.menu || []).find((entry) => entry.id === req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const name = cleanText(req.body.name, 120);
    const description = cleanText(req.body.description, 300);
    const price = cleanPrice(req.body.price);
    const image = cleanImageUrl(req.body.image);
    const available = Boolean(req.body.available);

    if (!name || price === null) {
      return res.status(400).json({ error: 'Menu item name and valid price are required' });
    }

    item.name = name;
    item.description = description;
    item.price = price;
    item.image = image;
    item.available = available;

    await writeDb(db);
    return res.json({ message: 'Menu item updated', item });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update menu item' });
  }
});

app.delete('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const originalLength = (db.menu || []).length;
    db.menu = (db.menu || []).filter((item) => item.id !== req.params.id);

    if (db.menu.length === originalLength) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await writeDb(db);
    return res.json({ message: 'Menu item deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to delete menu item' });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const db = await readDb();
    const order = (db.orders || []).find((entry) => entry.id === req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const status = cleanText(req.body.status, 30);
    const paid = typeof req.body.paid === 'boolean' ? req.body.paid : order.paid;

    if (status && ['ordered', 'collected', 'cancelled'].includes(status)) {
      order.status = status;
      if (status === 'collected' && !order.collectedAt) {
        order.collectedAt = new Date().toISOString();
      }
    }

    order.paid = paid;
    if (paid && !order.paidAt) {
      order.paidAt = new Date().toISOString();
    }

    await writeDb(db);
    return res.json({ message: 'Order updated', order });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update order' });
  }
});

app.get('*', (_req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

prepareDbPath()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`DilPanjab app running on http://localhost:${PORT} (db: ${DB_PATH})`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database path', error);
    process.exit(1);
  });
