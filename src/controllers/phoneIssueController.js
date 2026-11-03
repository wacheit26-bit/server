const User = require('../models/User');
const {
  listIssues,
  createIssue,
  clearIssue,
} = require('../utils/phoneIssueService');
const { assertSalesmanShopAccess } = require('../utils/salesmanShopAccess');

function resolveStaffUserId(req) {
  return String(req.userId || req.user?.userId || req.user?.id || req.user?._id || '').trim();
}

async function resolveReporter(req) {
  const userId = resolveStaffUserId(req);
  if (!userId) return { id: null, name: '' };
  const user = await User.findById(userId).select('name user businessName').lean();
  const name = String(user?.name || user?.user || user?.businessName || '').trim();
  return { id: userId, name };
}

/** GET /api/admin/phone-issues?ime= */
async function listAdminPhoneIssues(req, res) {
  try {
    const ime = String(req.query.ime || req.query.q || '').trim();
    const rows = await listIssues({ imeQuery: ime });
    return res.status(200).json({ success: true, data: { issues: rows, count: rows.length } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error('listAdminPhoneIssues:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not load phone issues.',
    });
  }
}

/** POST /api/admin/phone-issues { ime, description } */
async function createAdminPhoneIssue(req, res) {
  try {
    const ime = String(req.body?.ime || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!ime) {
      return res.status(400).json({ success: false, message: 'IME is required.' });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: 'Describe the problem before saving.' });
    }

    const reporter = await resolveReporter(req);
    const row = await createIssue({ ime, description, reporter, requireShop: false });
    return res.status(201).json({ success: true, data: row, message: 'Phone issue recorded.' });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error('createAdminPhoneIssue:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not record phone issue.',
    });
  }
}

/** DELETE /api/admin/phone-issues/:id */
async function clearAdminPhoneIssue(req, res) {
  try {
    await clearIssue(req.params.id);
    return res.status(200).json({ success: true, message: 'Issue cleared.' });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error('clearAdminPhoneIssue:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not clear issue.',
    });
  }
}

/** GET /api/sales/shops/:id/phone-issues?ime= */
async function listShopPhoneIssues(req, res) {
  try {
    const userId = resolveStaffUserId(req);
    const { shop } = await assertSalesmanShopAccess(userId, req.params.id);
    const ime = String(req.query.ime || req.query.q || '').trim();
    const rows = await listIssues({ shopId: String(shop._id), imeQuery: ime });
    return res.status(200).json({ success: true, data: { issues: rows, count: rows.length, shop: shop.name } });
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('listShopPhoneIssues:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not load shop phone issues.',
    });
  }
}

/** POST /api/sales/shops/:id/phone-issues { ime, description } */
async function createShopPhoneIssue(req, res) {
  try {
    const userId = resolveStaffUserId(req);
    const { shop } = await assertSalesmanShopAccess(userId, req.params.id);
    const ime = String(req.body?.ime || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!ime) {
      return res.status(400).json({ success: false, message: 'IME is required.' });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: 'Describe the problem before saving.' });
    }

    const reporter = await resolveReporter(req);
    const row = await createIssue({
      ime,
      description,
      reporter,
      shopId: String(shop._id),
      requireShop: true,
    });
    return res.status(201).json({ success: true, data: row, message: 'Phone issue recorded for this shop.' });
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    if (status >= 500) console.error('createShopPhoneIssue:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not record phone issue.',
    });
  }
}

/** DELETE /api/sales/shops/:id/phone-issues/:issueId */
async function clearShopPhoneIssue(req, res) {
  try {
    const userId = resolveStaffUserId(req);
    const { shop } = await assertSalesmanShopAccess(userId, req.params.id);
    await clearIssue(req.params.issueId, { shopId: String(shop._id) });
    return res.status(200).json({ success: true, message: 'Issue cleared.' });
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    if (status >= 500) console.error('clearShopPhoneIssue:', err);
    return res.status(status).json({
      success: false,
      message: err.message || 'Could not clear issue.',
    });
  }
}

module.exports = {
  listAdminPhoneIssues,
  createAdminPhoneIssue,
  clearAdminPhoneIssue,
  listShopPhoneIssues,
  createShopPhoneIssue,
  clearShopPhoneIssue,
};
