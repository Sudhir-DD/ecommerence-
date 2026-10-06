/* ================= API HELPER ================= */

async function api(url, options = {}) {
    const res = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
    }

    return data;
}

/* ================= TOAST ================= */

let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById('toast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/* ================= CART BADGE ================= */

function updateCartBadge() {
    const badge = document.getElementById('cartCount');

    if (!badge) {
        return;
    }

    api('/api/cart/count')
        .then((data) => {
            badge.textContent = data.count;
        })
        .catch(() => {
            badge.textContent = '0';
        });
}

/* ================= PRICE ALERT BADGE ================= */

function updateAlertBadge() {
    const badge = document.getElementById('alertBadge');

    if (!badge) {
        return;
    }

    api('/api/price-alerts/count')
        .then((data) => {
            badge.textContent = data.count;
            badge.hidden = data.count === 0;
        })
        .catch(() => {
            badge.hidden = true;
        });
}

/* ================= LOCATION ================= */

// textContent, not innerHTML: the location is free text typed by the user.
function setLocationText(place) {
    const city = document.querySelector('#locationText .city');

    if (city) {
        city.textContent = place;
    }
}

function changeLocation() {
    let place = prompt('Enter your delivery location:');

    if (place && place.trim() !== '') {
        place = place.trim();
        setLocationText(place);
        localStorage.setItem('userLocation', place);
    }
}

function loadLocation() {
    const saved = localStorage.getItem('userLocation');

    if (saved) {
        setLocationText(saved);
    }
}

/* ================= LANGUAGE ================= */

function changeLanguage() {
    let language = prompt('Enter language: ENG / HIN / TEL');

    if (!language) {
        return;
    }

    language = language.trim().toUpperCase();

    if (!['ENG', 'HIN', 'TEL'].includes(language)) {
        showToast('Please enter ENG, HIN or TEL.');
        return;
    }

    document.getElementById('language').innerText = language;
    localStorage.setItem('userLanguage', language);
}

function loadLanguage() {
    const saved = localStorage.getItem('userLanguage');
    const el = document.getElementById('language');

    if (saved && el) {
        el.innerText = saved;
    }
}

/* ================= LOGIN NAV ================= */

function logout() {
    api('/api/auth/logout', { method: 'POST' })
        .catch(() => {})
        .then(() => {
            window.location.href = '/login';
        });
}

/* ================= ADD TO CART (category pages) ================= */

function handleAuthError(err) {
    if (err.message === 'Login required') {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        return true;
    }

    return false;
}

function initAddToCartButtons() {
    document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const productId = btn.getAttribute('data-product-id');
            const name = btn.getAttribute('data-product-name');

            api('/api/cart', { method: 'POST', body: { productId: Number(productId), quantity: 1 } })
                .then(() => {
                    showToast(name + ' added to cart');
                    updateCartBadge();
                })
                .catch((err) => {
                    if (!handleAuthError(err)) {
                        showToast(err.message);
                    }
                });
        });
    });
}

/* ================= BUY NOW (category pages) ================= */

function initBuyNowButtons() {
    document.querySelectorAll('[data-buy-now]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const productId = btn.getAttribute('data-product-id');
            const name = btn.getAttribute('data-product-name');

            btn.disabled = true;

            api('/api/buy-now', { method: 'POST', body: { productId: Number(productId), quantity: 1 } })
                .then(() => {
                    showToast('Order placed for ' + name);
                    setTimeout(() => {
                        window.location.href = '/orders';
                    }, 900);
                })
                .catch((err) => {
                    btn.disabled = false;

                    if (!handleAuthError(err)) {
                        showToast(err.message);
                    }
                });
        });
    });
}

/* ================= PRICE ALERT MODAL ================= */

let priceAlertContext = null;

function openPriceAlertModal({ productId, name, currentPrice, prefillTarget }) {
    const overlay = document.getElementById('priceAlertModal');

    if (!overlay) {
        return;
    }

    priceAlertContext = { productId, name };

    document.getElementById('priceAlertModalTitle').textContent = 'Alert for ' + name;
    document.getElementById('priceAlertModalCurrentPrice').textContent =
        '₹' + currentPrice.toLocaleString('en-IN');

    const input = document.getElementById('priceAlertModalInput');
    input.value = prefillTarget || '';
    input.max = '';

    overlay.classList.add('show');
    setTimeout(() => input.focus(), 50);
}

function closePriceAlertModal() {
    const overlay = document.getElementById('priceAlertModal');

    if (overlay) {
        overlay.classList.remove('show');
    }

    priceAlertContext = null;
}

function submitPriceAlertModal() {
    if (!priceAlertContext) {
        return;
    }

    const input = document.getElementById('priceAlertModalInput');
    const targetPrice = Number(input.value);

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        showToast('Please enter a valid price.');
        return;
    }

    const { productId, name } = priceAlertContext;

    api('/api/price-alerts', {
        method: 'POST',
        body: { productId: Number(productId), targetPrice }
    })
        .then((data) => {
            showToast('Price alert set for ' + name);
            closePriceAlertModal();
            updateAlertBadge();

            if (typeof onPriceAlertsUpdated === 'function') {
                onPriceAlertsUpdated(data.alerts);
            }
        })
        .catch((err) => {
            if (!handleAuthError(err)) {
                showToast(err.message);
            }
        });
}

function initPriceAlertModal() {
    const overlay = document.getElementById('priceAlertModal');

    if (!overlay) {
        return;
    }

    document.getElementById('priceAlertModalClose').addEventListener('click', closePriceAlertModal);
    document.getElementById('priceAlertModalCancel').addEventListener('click', closePriceAlertModal);
    document.getElementById('priceAlertModalSubmit').addEventListener('click', submitPriceAlertModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePriceAlertModal();
        }
    });

    document.getElementById('priceAlertModalInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitPriceAlertModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('show')) {
            closePriceAlertModal();
        }
    });
}

/* ================= PRICE ALERT BUTTONS (category pages) ================= */

function initPriceAlertButtons() {
    document.querySelectorAll('[data-price-alert]').forEach((btn) => {
        btn.addEventListener('click', () => {
            openPriceAlertModal({
                productId: btn.getAttribute('data-product-id'),
                name: btn.getAttribute('data-product-name'),
                currentPrice: Number(btn.getAttribute('data-current-price'))
            });
        });
    });
}

/* ================= SORT (category + search pages) ================= */

function initSortSelect() {
    const select = document.getElementById('sortSelect');

    if (!select) {
        return;
    }

    select.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('sort', select.value);
        window.location.href = url.pathname + url.search;
    });
}

/* ================= PAGE INIT ================= */

document.addEventListener('DOMContentLoaded', () => {
    loadLocation();
    loadLanguage();
    updateCartBadge();
    updateAlertBadge();
    initSortSelect();
    initAddToCartButtons();
    initBuyNowButtons();
    initPriceAlertButtons();
    initPriceAlertModal();
});
