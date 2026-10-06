const db = require('./database');
const priceHistory = require('../models/priceHistory');
const { mulberry32, gauss, roundPrice } = require('../services/priceUtils');

const products = [
    // mobiles
    { category: 'mobiles', name: 'iPhone 15', description: '128 GB | Pink', rating: 4, price: 78900, image: 'images/phone.png' },
    { category: 'mobiles', name: 'Samsung S24', description: '256 GB | Grey', rating: 5, price: 74999, image: 'images/samsung.png' },
    { category: 'mobiles', name: 'Vivo Y19 Series', description: '128 GB | Blue', rating: 4, price: 14999, image: 'images/vivo.png' },
    { category: 'mobiles', name: 'Oppo K13X 5G', description: '128 GB | Blue', rating: 4, price: 16999, image: 'images/oppo.png' },
    { category: 'mobiles', name: 'Realme 12 Pro', description: '256 GB | Yellow', rating: 4, price: 26999, image: 'images/realme.png' },

    // watches
    { category: 'watches', name: 'Rolex', description: 'Luxury Watch', rating: 4, price: 950000, image: 'images/rolex.jpeg' },
    { category: 'watches', name: 'Patek Philippe Nautilus', description: 'Luxury Watch', rating: 5, price: 3500000, image: 'images/patel phillipe.jpeg' },
    { category: 'watches', name: 'Cartier Santos', description: 'Luxury Watch', rating: 4, price: 680000, image: 'images/catier.jpeg' },
    { category: 'watches', name: 'Grand Seiko', description: 'Luxury Watch', rating: 4, price: 420000, image: 'images/grand seiko.jpeg' },
    { category: 'watches', name: 'Breitling Navitimer', description: 'Luxury Watch', rating: 4, price: 710000, image: 'images/breitling.jpeg' },

    // laptops
    { category: 'laptops', name: 'HP Laptop', description: 'Intel i5 | 8GB RAM | 512GB SSD', rating: null, price: 55999, image: 'images/hp-laptop.png' },
    { category: 'laptops', name: 'Dell Inspiron', description: 'Intel i5 | 16GB RAM | 512GB SSD', rating: null, price: 62999, image: 'images/dell-laptop.png' },
    { category: 'laptops', name: 'MacBook Air', description: 'Apple M2 | 8GB RAM | 256GB SSD', rating: null, price: 89999, image: 'images/macbook.png' },
    { category: 'laptops', name: 'Lenovo IdeaPad', description: 'Intel i7 | 16GB RAM | 1TB SSD', rating: null, price: 69999, image: 'images/lenovo-laptop.png' },

    // shoes
    { category: 'shoes', name: 'Nike Running Shoes', description: 'Sports | Black', rating: null, price: 5999, image: 'images/nike-shoes.png' },
    { category: 'shoes', name: 'Adidas Sports Shoes', description: 'Running | White', rating: null, price: 4999, image: 'images/adidas-shoes.png' },
    { category: 'shoes', name: 'Puma Sneakers', description: 'Casual | Black', rating: null, price: 3999, image: 'images/puma-shoes.png' },
    { category: 'shoes', name: 'Sparx Casual Shoes', description: 'Casual | Grey', rating: null, price: 1999, image: 'images/sparx-shoes.png' },

    // clothes
    { category: 'clothes', name: "Men's T-Shirt", description: 'Cotton | Black', rating: null, price: 799, image: 'images/tshirt.png' },
    { category: 'clothes', name: 'Formal Shirt', description: 'Cotton | Blue', rating: null, price: 1299, image: 'images/shirt.png' },
    { category: 'clothes', name: "Men's Jeans", description: 'Denim | Blue', rating: null, price: 1799, image: 'images/jeans.png' },
    { category: 'clothes', name: 'Winter Jacket', description: 'Warm | Black', rating: null, price: 2499, image: 'images/jacket.png' },

    // electronics
    { category: 'electronics', name: 'Wireless Headphones', description: 'Bluetooth | Noise Reduction', rating: null, price: 2499, image: 'images/headphones.png' },
    { category: 'electronics', name: 'Wireless Earbuds', description: 'Bluetooth | Charging Case', rating: null, price: 1999, image: 'images/earbuds.png' },
    { category: 'electronics', name: 'Bluetooth Speaker', description: 'Portable | Waterproof', rating: null, price: 2999, image: 'images/speaker.png' },
    { category: 'electronics', name: 'Power Bank', description: '20,000mAh | Fast Charging', rating: null, price: 1499, image: 'images/powerbank.png' }
];

const HISTORY_DAYS = 90;

function utcTimestamp(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// A believable price path ending exactly at today's price: a per-product
// drift (some products trend down, some up), daily noise, mean reversion and
// the odd sale-day dip. Deterministic per product id.
function generateHistory(product) {
    const rand = mulberry32(product.id * 9973 + 17);
    const drift = (rand() - 0.6) * 0.006;
    const vol = 0.008 + rand() * 0.008;

    const path = [0];
    let logPrice = 0;

    for (let day = 1; day < HISTORY_DAYS; day++) {
        const reversion = -0.04 * logPrice;
        const dip = rand() < 0.04 ? -(0.03 + rand() * 0.05) : 0;
        logPrice += drift + reversion + gauss(rand) * vol + dip;
        path.push(logPrice);
    }

    const scale = product.price / Math.exp(path[path.length - 1]);

    return path.map((p, i) => {
        const price = i === path.length - 1 ? product.price : roundPrice(Math.exp(p) * scale);
        const daysAgo = HISTORY_DAYS - 1 - i;
        const when = new Date();

        if (daysAgo === 0) {
            return { price, recordedAt: utcTimestamp(when) };
        }

        when.setUTCDate(when.getUTCDate() - daysAgo);
        when.setUTCHours(12, 0, 0, 0);

        return { price, recordedAt: utcTimestamp(when) };
    });
}

function seedPriceHistory() {
    const missing = db
        .prepare('SELECT id, price FROM products')
        .all()
        .filter((p) => !priceHistory.hasHistory(p.id));

    if (missing.length === 0) {
        return;
    }

    db.exec('BEGIN');

    try {
        for (const product of missing) {
            for (const point of generateHistory(product)) {
                priceHistory.record(product.id, point.price, point.recordedAt);
            }
        }

        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    console.log(`Seeded ${HISTORY_DAYS} days of price history for ${missing.length} products.`);
}

function seed() {
    seedProducts();
    seedPriceHistory();
}

function seedProducts() {
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM products').get();

    if (countRow.count > 0) {
        return;
    }

    const insert = db.prepare(
        'INSERT INTO products (category, name, description, rating, price, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const perCategoryIndex = {};

    for (const product of products) {
        const nextIndex = perCategoryIndex[product.category] || 0;

        insert.run(
            product.category,
            product.name,
            product.description,
            product.rating,
            product.price,
            product.image,
            nextIndex
        );

        perCategoryIndex[product.category] = nextIndex + 1;
    }

    console.log(`Seeded ${products.length} products.`);
}

module.exports = seed;

if (require.main === module) {
    seed();
}
