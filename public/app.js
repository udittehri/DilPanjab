const state = {
  adminPin: window.localStorage.getItem('dilpanjab_admin_pin') || '',
  adminData: null,
  publicData: null
};

const elements = {
  businessName: document.querySelector('#businessName'),
  businessAddress: document.querySelector('#businessAddress'),
  businessPhone: document.querySelector('#businessPhone'),
  collectionNote: document.querySelector('#collectionNote'),
  mealImage: document.querySelector('#mealImage'),
  todaysDate: document.querySelector('#todaysDate'),
  mealName: document.querySelector('#mealName'),
  mealDescription: document.querySelector('#mealDescription'),
  mealPrice: document.querySelector('#mealPrice'),
  mealAvailability: document.querySelector('#mealAvailability'),
  orderForm: document.querySelector('#orderForm'),
  orderEstimate: document.querySelector('#orderEstimate'),
  orderFeedback: document.querySelector('#orderFeedback'),
  menuList: document.querySelector('#menuList'),
  adminLoginForm: document.querySelector('#adminLoginForm'),
  adminFeedback: document.querySelector('#adminFeedback'),
  adminArea: document.querySelector('#adminArea'),
  businessForm: document.querySelector('#businessForm'),
  todayForm: document.querySelector('#todayForm'),
  menuForm: document.querySelector('#menuForm'),
  adminMenuList: document.querySelector('#adminMenuList'),
  ordersList: document.querySelector('#ordersList')
};

const DEFAULT_IMAGES = {
  hero: '/images/hero-thali.svg',
  today: '/images/today-curry.svg',
  burger: '/images/menu-burger.svg',
  curry: '/images/menu-curry.svg',
  paneer: '/images/menu-paneer-sandwich.svg',
  tikki: '/images/menu-tikki.svg',
  fries: '/images/menu-fries.svg',
  generic: '/images/menu-default.svg'
};

function imageFromName(name, isToday = false) {
  const label = String(name || '').toLowerCase();
  if (label.includes('paneer')) return DEFAULT_IMAGES.paneer;
  if (label.includes('tikki')) return DEFAULT_IMAGES.tikki;
  if (label.includes('fries')) return DEFAULT_IMAGES.fries;
  if (label.includes('burger')) return DEFAULT_IMAGES.burger;
  if (label.includes('curry')) return DEFAULT_IMAGES.curry;
  if (isToday) return DEFAULT_IMAGES.today;
  return DEFAULT_IMAGES.generic;
}

function cleanImage(input, fallback) {
  const value = String(input || '').trim();
  if (!value) return fallback;
  if (value.startsWith('/') || value.startsWith('images/') || /^https?:\/\//i.test(value)) {
    return value;
  }
  return fallback;
}

function setFeedback(node, message, isError = false) {
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', isError);
}

function getField(form, name) {
  return form?.querySelector(`[name="${name}"]`) || null;
}

async function api(url, options = {}, withAdmin = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (withAdmin) {
    headers['x-admin-pin'] = state.adminPin;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function prettyDate(isoDate) {
  if (!isoDate) return 'No date set';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString();
}

function prettyDateFromYMD(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || 'Not provided';
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function updateOrderEstimate() {
  if (!elements.orderForm || !elements.orderEstimate) return;

  const quantityField = getField(elements.orderForm, 'quantity');
  const pickupDateField = getField(elements.orderForm, 'pickupDate');
  const unitPrice = Number(state.publicData?.todaysMeal?.price || 0);
  const quantityRaw = Number(quantityField?.value || 1);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
  const pickupDate = pickupDateField?.value;
  const pickupLabel = pickupDate ? prettyDateFromYMD(pickupDate) : 'choose a date';
  const total = Number((quantity * unitPrice).toFixed(2));

  elements.orderEstimate.textContent = `Estimated total: ${money(total)} · Pickup ${pickupLabel} at 7:00 PM`;
}

function toWhatsAppPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function buildWhatsAppUrl(order) {
  const phone = toWhatsAppPhone(order.phone);
  if (!phone) return null;

  const pickupDate = prettyDateFromYMD(order.pickupDate);
  const pickupTime = order.pickupTime || '7:00 PM';
  const message = `Sat Sri Akal ${order.customerName}, your DilPanjab order (${order.quantity} x ${order.mealName}) is confirmed for ${pickupDate} at ${pickupTime}. Total due on collection: ${money(order.total)}.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderPublic(data) {
  state.publicData = data;

  elements.businessName.textContent = data.business?.name || 'DilPanjab';
  elements.businessAddress.textContent = `Address: ${data.business?.address || ''}`;
  elements.businessPhone.textContent = data.business?.phone ? `Call: ${data.business.phone}` : '';
  elements.collectionNote.textContent = data.business?.collectionNote || 'Collection at 7:00 PM daily.';

  const meal = data.todaysMeal || {};
  const mealImage = cleanImage(meal.image, imageFromName(meal.name, true));
  elements.todaysDate.textContent = meal.date ? prettyDate(meal.date) : new Date().toLocaleDateString();
  elements.mealName.textContent = meal.name || 'Meal not set';
  elements.mealDescription.textContent = meal.description || '';
  elements.mealPrice.textContent = `Price: ${money(meal.price)}`;
  elements.mealAvailability.textContent = meal.available ? 'Available to order now' : 'Not available right now';
  elements.mealAvailability.classList.toggle('error', !meal.available);
  if (elements.mealImage) {
    elements.mealImage.src = mealImage;
    elements.mealImage.alt = meal.name ? `${meal.name} image` : "Today's meal image";
  }

  elements.orderForm.querySelector('button[type="submit"]').disabled = !meal.available;
  updateOrderEstimate();

  if (!data.menu?.length) {
    elements.menuList.innerHTML = '<p class="helper">Menu will appear here.</p>';
  } else {
    elements.menuList.innerHTML = data.menu
      .map(
        (item) => `
        <article class="menu-item">
          <img class="menu-item-visual" src="${escapeHtml(cleanImage(item.image, imageFromName(item.name)))}" alt="${escapeHtml(item.name)}" loading="lazy" />
          <div class="menu-item-head">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="price">${money(item.price)}</p>
          </div>
          <p class="helper">${escapeHtml(item.description || '')}</p>
        </article>
      `
      )
      .join('');
  }
}

function renderAdmin(data) {
  state.adminData = data;

  const businessName = getField(elements.businessForm, 'name');
  const businessAddress = getField(elements.businessForm, 'address');
  const businessPhone = getField(elements.businessForm, 'phone');
  const businessCollectionNote = getField(elements.businessForm, 'collectionNote');

  if (businessName) businessName.value = data.business?.name || '';
  if (businessAddress) businessAddress.value = data.business?.address || '';
  if (businessPhone) businessPhone.value = data.business?.phone || '';
  if (businessCollectionNote) businessCollectionNote.value = data.business?.collectionNote || '';

  const todayName = getField(elements.todayForm, 'name');
  const todayDescription = getField(elements.todayForm, 'description');
  const todayPrice = getField(elements.todayForm, 'price');
  const todayDate = getField(elements.todayForm, 'date');
  const todayImage = getField(elements.todayForm, 'image');
  const todayAvailable = getField(elements.todayForm, 'available');

  if (todayName) todayName.value = data.todaysMeal?.name || '';
  if (todayDescription) todayDescription.value = data.todaysMeal?.description || '';
  if (todayPrice) todayPrice.value = data.todaysMeal?.price ?? '';
  if (todayDate) todayDate.value = data.todaysMeal?.date || '';
  if (todayImage) todayImage.value = data.todaysMeal?.image || '';
  if (todayAvailable) todayAvailable.checked = Boolean(data.todaysMeal?.available);

  if (!data.menu?.length) {
    elements.adminMenuList.innerHTML = '<p class="helper">No menu items yet.</p>';
  } else {
    elements.adminMenuList.innerHTML = data.menu
      .map(
        (item) => `
      <article class="card" data-menu-id="${item.id}">
        <img class="admin-item-image" src="${escapeHtml(cleanImage(item.image, imageFromName(item.name)))}" alt="${escapeHtml(item.name)}" loading="lazy" />
        <div class="card-head">
          <p class="card-title">${escapeHtml(item.name)} · ${money(item.price)}</p>
          <span class="pill ${item.available ? '' : 'off'}">${item.available ? 'Visible' : 'Hidden'}</span>
        </div>
        <p class="helper">${escapeHtml(item.description || '')}</p>
        <div class="row">
          <button type="button" data-action="edit-menu" data-id="${item.id}">Edit</button>
          <button type="button" class="secondary" data-action="toggle-menu" data-id="${item.id}">
            ${item.available ? 'Hide' : 'Show'}
          </button>
          <button type="button" class="muted" data-action="delete-menu" data-id="${item.id}">Delete</button>
        </div>
      </article>
    `
      )
      .join('');
  }

  if (!data.orders?.length) {
    elements.ordersList.innerHTML = '<p class="helper">No orders yet.</p>';
  } else {
    elements.ordersList.innerHTML = data.orders
      .map(
        (order) => `
      <article class="card">
        <div class="card-head">
          <p class="card-title">${escapeHtml(order.customerName)} · ${money(order.total)}</p>
          <span class="pill ${order.paid ? '' : 'off'}">${order.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <p class="helper">Order ID: ${escapeHtml(order.id)}</p>
        <p class="helper">Meal: ${escapeHtml(order.mealName)} · Qty: ${order.quantity}</p>
        <p class="helper">Phone: ${escapeHtml(order.phone)}</p>
        <p class="helper">Pickup: ${escapeHtml(prettyDateFromYMD(order.pickupDate))} at ${escapeHtml(order.pickupTime || '7:00 PM')}</p>
        <p class="helper">Status: ${escapeHtml(order.status)} · Ordered ${prettyDate(order.createdAt)}</p>
        ${order.note ? `<p class="helper">Note: ${escapeHtml(order.note)}</p>` : ''}
        <div class="row">
          <button type="button" data-action="collect-order" data-id="${order.id}">Mark Collected</button>
          <button type="button" class="secondary" data-action="pay-order" data-id="${order.id}">
            ${order.paid ? 'Mark Unpaid' : 'Mark Paid'}
          </button>
          <button type="button" class="secondary" data-action="whatsapp-order" data-id="${order.id}">
            WhatsApp
          </button>
          <button type="button" class="muted" data-action="cancel-order" data-id="${order.id}">Cancel</button>
        </div>
      </article>
    `
      )
      .join('');
  }
}

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refreshPublic() {
  try {
    const payload = await api('/api/public', { method: 'GET' });
    renderPublic(payload);
  } catch (error) {
    setFeedback(elements.orderFeedback, error.message, true);
  }
}

async function refreshAdmin(showAuthError = true) {
  if (!state.adminPin) return;

  try {
    const payload = await api('/api/admin/data', { method: 'GET' }, true);
    elements.adminArea.classList.remove('hidden');
    renderAdmin(payload);
  } catch (error) {
    if (error.message.toLowerCase().includes('unauthorized')) {
      state.adminPin = '';
      window.localStorage.removeItem('dilpanjab_admin_pin');
      elements.adminArea.classList.add('hidden');
      if (showAuthError) {
        setFeedback(elements.adminFeedback, 'Invalid/expired PIN. Please login again.', true);
      } else {
        setFeedback(elements.adminFeedback, '');
      }
      return;
    }
    setFeedback(elements.adminFeedback, error.message, true);
  }
}

elements.orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFeedback(elements.orderFeedback, 'Placing order...');
  const form = event.currentTarget;

  const formData = new FormData(form);

  const payload = {
    customerName: formData.get('customerName'),
    phone: formData.get('phone'),
    quantity: Number(formData.get('quantity')),
    pickupDate: formData.get('pickupDate'),
    note: formData.get('note')
  };

  try {
    const result = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    form.reset();
    const quantityField = getField(form, 'quantity');
    if (quantityField) quantityField.value = '1';
    updateOrderEstimate();
    setFeedback(
      elements.orderFeedback,
      `${result.message} Pickup: ${prettyDateFromYMD(result.order.pickupDate)} at ${result.order.pickupTime}. Order ID: ${result.order.id}`
    );
    await refreshAdmin(false);
  } catch (error) {
    setFeedback(elements.orderFeedback, error.message, true);
  }
});

elements.adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const pin = String(formData.get('pin') || '').trim();

  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });
    state.adminPin = pin;
    window.localStorage.setItem('dilpanjab_admin_pin', pin);
    setFeedback(elements.adminFeedback, 'Admin unlocked');
    form.reset();
    await refreshAdmin(true);
  } catch (error) {
    state.adminPin = '';
    window.localStorage.removeItem('dilpanjab_admin_pin');
    elements.adminArea.classList.add('hidden');
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

elements.businessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    name: formData.get('name'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    collectionNote: formData.get('collectionNote')
  };

  try {
    await api('/api/admin/business', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }, true);
    setFeedback(elements.adminFeedback, 'Business details saved');
    await Promise.all([refreshAdmin(), refreshPublic()]);
  } catch (error) {
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

elements.todayForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    name: formData.get('name'),
    description: formData.get('description'),
    price: Number(formData.get('price')),
    date: formData.get('date'),
    image: formData.get('image'),
    available: formData.get('available') === 'on'
  };

  try {
    await api('/api/admin/today', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }, true);
    setFeedback(elements.adminFeedback, "Today's meal updated");
    await Promise.all([refreshAdmin(), refreshPublic()]);
  } catch (error) {
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

elements.menuForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    name: formData.get('name'),
    description: formData.get('description'),
    price: Number(formData.get('price')),
    image: formData.get('image'),
    available: formData.get('available') === 'on'
  };

  try {
    await api('/api/admin/menu', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, true);
    form.reset();
    const availableField = getField(form, 'available');
    if (availableField) availableField.checked = true;
    setFeedback(elements.adminFeedback, 'Menu item added');
    await Promise.all([refreshAdmin(), refreshPublic()]);
  } catch (error) {
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

elements.adminMenuList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const item = state.adminData?.menu?.find((entry) => entry.id === id);
  if (!item) return;

  try {
    if (action === 'delete-menu') {
      if (!window.confirm('Delete this menu item?')) return;
      await api(`/api/admin/menu/${id}`, { method: 'DELETE' }, true);
      setFeedback(elements.adminFeedback, 'Menu item deleted');
    }

    if (action === 'toggle-menu') {
      await api(
        `/api/admin/menu/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: item.name,
            description: item.description,
            price: item.price,
            image: item.image,
            available: !item.available
          })
        },
        true
      );
      setFeedback(elements.adminFeedback, 'Menu visibility updated');
    }

    if (action === 'edit-menu') {
      const name = window.prompt('Item name:', item.name);
      if (name === null) return;

      const description = window.prompt('Description:', item.description || '') ?? '';
      const priceValue = window.prompt('Price:', String(item.price));
      if (priceValue === null) return;
      const image = window.prompt('Image URL:', item.image || '') ?? '';

      await api(
        `/api/admin/menu/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name,
            description,
            price: Number(priceValue),
            image,
            available: item.available
          })
        },
        true
      );
      setFeedback(elements.adminFeedback, 'Menu item updated');
    }

    await Promise.all([refreshAdmin(), refreshPublic()]);
  } catch (error) {
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

elements.ordersList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const order = state.adminData?.orders?.find((entry) => entry.id === id);
  if (!order) return;

  if (action === 'whatsapp-order') {
    const url = buildWhatsAppUrl(order);
    if (!url) {
      setFeedback(elements.adminFeedback, 'Valid phone number required for WhatsApp link.', true);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    setFeedback(elements.adminFeedback, 'Opened WhatsApp message draft.');
    return;
  }

  // SMS provider integrations (for example Twilio) are usually paid plans.
  let payload = {};

  if (action === 'collect-order') {
    payload = { status: 'collected', paid: order.paid };
  }

  if (action === 'pay-order') {
    payload = { status: order.status, paid: !order.paid };
  }

  if (action === 'cancel-order') {
    if (!window.confirm('Cancel this order?')) return;
    payload = { status: 'cancelled', paid: order.paid };
  }

  try {
    await api(
      `/api/admin/orders/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      },
      true
    );
    setFeedback(elements.adminFeedback, 'Order updated');
    await refreshAdmin();
  } catch (error) {
    setFeedback(elements.adminFeedback, error.message, true);
  }
});

(async function init() {
  const quantityField = getField(elements.orderForm, 'quantity');
  const pickupDateField = getField(elements.orderForm, 'pickupDate');
  if (quantityField) {
    quantityField.addEventListener('input', updateOrderEstimate);
    quantityField.addEventListener('change', updateOrderEstimate);
  }
  if (pickupDateField) {
    pickupDateField.min = new Date().toISOString().slice(0, 10);
    pickupDateField.addEventListener('input', updateOrderEstimate);
    pickupDateField.addEventListener('change', updateOrderEstimate);
  }

  await refreshPublic();
  updateOrderEstimate();
  if (state.adminPin) {
    await refreshAdmin(false);
  }
})();
