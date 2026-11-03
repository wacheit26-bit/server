const Product = require('../models/ItemsList');
const PhoneIssue = require('../models/PhoneIssue');
const { normalizedImeList } = require('./productIme');
const { WAREHOUSE_POPULATE } = require('./warehousePopulate');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function warehouseRefId(ref) {
  if (!ref) return '';
  if (typeof ref === 'object') return String(ref._id || ref.id || '').trim();
  return String(ref).trim();
}

function productLocationLabel(product) {
  const wh = product?.currentWarehouse;
  if (wh && typeof wh === 'object' && wh.name) {
    return wh.city ? `${wh.name} (${wh.city})` : wh.name;
  }
  const legacy = String(product?.phoneLocation || '').trim();
  return legacy || '—';
}

function isOnHandAtShop(product, shopId) {
  if (!product || !shopId) return false;
  if (String(product?.shipmentStatus || 'arrived').toLowerCase() === 'travelling') return false;
  return warehouseRefId(product.currentWarehouse) === String(shopId);
}

/** Resolve inventory product line that owns this IME (exact match). */
async function findProductLineByIme(imeInput) {
  const query = String(imeInput || '').trim();
  if (query.length < 3) {
    const err = new Error('Enter a valid IME (at least 3 characters).');
    err.statusCode = 400;
    throw err;
  }

  const exactRegex = new RegExp(`^${escapeRegex(query)}$`, 'i');
  const candidates = await Product.find({
    $or: [{ IME: exactRegex }, { imeCodes: exactRegex }],
  }).populate(WAREHOUSE_POPULATE);

  for (const product of candidates) {
    const imes = normalizedImeList(product);
    const match = imes.find((code) => code.toLowerCase() === query.toLowerCase());
    if (match) {
      return { product, ime: match };
    }
  }

  return null;
}

function serializeProductDetail(product) {
  if (!product) return null;
  const doc = typeof product.toObject === 'function' ? product.toObject() : product;
  return {
    id: doc._id,
    _id: doc._id,
    product_name: doc.product_name,
    product_type: doc.product_type,
    brand: doc.brand,
    capacity: doc.capacity,
    color: doc.color,
    country: doc.country,
    sim: doc.sim,
    batteryHealth: doc.batteryHealth,
    conditionStatus: doc.conditionStatus,
    stock: doc.stock,
    price: doc.price,
    costPrice: doc.costPrice,
    shipmentStatus: doc.shipmentStatus,
    phoneLocation: doc.phoneLocation,
    bulkBatchCode: doc.bulkBatchCode,
    IME: doc.IME,
    imeCodes: doc.imeCodes,
    currentWarehouse: doc.currentWarehouse,
    locationLabel: productLocationLabel(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeIssue(issue, product) {
  const liveLocation = product ? productLocationLabel(product) : issue.locationLabel || '—';
  return {
    id: String(issue._id),
    ime: issue.ime,
    description: issue.description,
    createdAt: issue.createdAt,
    reportedByName: issue.reportedByName || '',
    locationLabel: liveLocation,
    productName: issue.productName || product?.product_name || '',
    brand: issue.brand || product?.brand || '',
    capacity: issue.capacity || product?.capacity || '',
    color: issue.color || product?.color || '',
    warehouseId: issue.warehouseId ? String(issue.warehouseId) : '',
    product: serializeProductDetail(product),
  };
}

async function listIssues({ shopId = '', imeQuery = '' } = {}) {
  const filter = {};
  if (shopId) {
    filter.warehouseId = shopId;
  }

  const ime = String(imeQuery || '').trim();
  if (ime.length >= 3) {
    filter.ime = new RegExp(escapeRegex(ime), 'i');
  }

  const issues = await PhoneIssue.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  if (!issues.length) return [];

  const productIds = [...new Set(issues.map((row) => String(row.productId)).filter(Boolean))];
  const products = await Product.find({ _id: { $in: productIds } }).populate(WAREHOUSE_POPULATE);
  const productById = new Map(products.map((p) => [String(p._id), p]));

  return issues.map((issue) => {
    const product = productById.get(String(issue.productId));
    return serializeIssue(issue, product);
  });
}

async function createIssue({ ime, description, reporter, shopId = null, requireShop = false }) {
  const resolved = await findProductLineByIme(ime);
  if (!resolved) {
    const err = new Error('No inventory product found with this IME.');
    err.statusCode = 404;
    throw err;
  }

  const { product, ime: normalizedIme } = resolved;

  if (requireShop) {
    if (!shopId || !isOnHandAtShop(product, shopId)) {
      const err = new Error('This IME is not in on-hand inventory at this shop.');
      err.statusCode = 400;
      throw err;
    }
  }

  const existing = await PhoneIssue.findOne({ ime: normalizedIme }).lean();
  if (existing) {
    const err = new Error('This phone already has an open issue recorded.');
    err.statusCode = 409;
    throw err;
  }

  const whId = shopId || warehouseRefId(product.currentWarehouse) || null;
  const issue = await PhoneIssue.create({
    ime: normalizedIme,
    productId: product._id,
    description: String(description || '').trim(),
    warehouseId: whId || undefined,
    locationLabel: productLocationLabel(product),
    productName: product.product_name || '',
    brand: product.brand || '',
    capacity: product.capacity || '',
    color: product.color || '',
    reportedBy: reporter?.id || null,
    reportedByName: reporter?.name || '',
  });

  const freshProduct = await Product.findById(product._id).populate(WAREHOUSE_POPULATE);
  return serializeIssue(issue.toObject(), freshProduct);
}

async function clearIssue(issueId, { shopId = null } = {}) {
  const id = String(issueId || '').trim();
  if (!id) {
    const err = new Error('Issue id is required.');
    err.statusCode = 400;
    throw err;
  }

  const issue = await PhoneIssue.findById(id);
  if (!issue) {
    const err = new Error('Issue not found.');
    err.statusCode = 404;
    throw err;
  }

  if (shopId && String(issue.warehouseId || '') !== String(shopId)) {
    const err = new Error('This issue does not belong to this shop.');
    err.statusCode = 403;
    throw err;
  }

  await PhoneIssue.deleteOne({ _id: issue._id });
  return { cleared: true, id };
}

module.exports = {
  findProductLineByIme,
  isOnHandAtShop,
  productLocationLabel,
  listIssues,
  createIssue,
  clearIssue,
  serializeIssue,
};
