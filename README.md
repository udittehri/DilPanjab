# DilPanjab App

A simple meal-ordering app for a small food business.

## Features

- Public customer page:
  - Shows `What's Today?` meal (name, description, price, availability).
  - Shows image cards for today's meal and menu items.
  - Lets customers place an order for the meal of the day.
  - Customers choose pickup `date`; collection time is fixed at `7:00 PM` daily.
  - Shows live order estimate based on quantity.
  - Payment model: `Pay on collection`.
  - Displays menu items with prices.
  - Displays business address and phone.

- Admin section (PIN protected):
  - Update business details (name, address, phone, collection note).
  - Update `What's Today?` meal, image, and availability.
  - Add/edit/hide/delete menu items with image URLs.
  - View orders and mark as `collected`, `paid`, or `cancelled`.
  - Open prefilled WhatsApp order message drafts to notify customers.
  - SMS is not enabled by default because most SMS gateways are paid.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open:

```text
http://localhost:3000
```

## Admin access

- Default admin PIN: `1010`
- You should change it in production by setting env var:

```bash
ADMIN_PIN=your_secure_pin npm start
```

## Data storage

- App data is stored in `data/db.json`.
- This includes business info, today's meal, menu, and orders.

## Main files

- Backend API: `server.js`
- Frontend: `public/index.html`, `public/styles.css`, `public/app.js`
- Data: `data/db.json`

## AWS deployment (quick start)

Recommended simple option:

1. Create an `EC2` instance (Ubuntu).
2. Install Node.js (LTS), copy project, and run:

```bash
npm install
ADMIN_PIN=your_secure_pin npm start
```

3. Use `pm2` or a systemd service to keep the app running.
4. Put `Nginx` in front of the app and route port `80/443` to `localhost:3000`.
5. Attach a domain and TLS certificate (Let's Encrypt or AWS Certificate Manager + Load Balancer).
