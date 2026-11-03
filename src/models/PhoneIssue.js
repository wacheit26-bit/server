const mongoose = require('mongoose');

const phoneIssueSchema = new mongoose.Schema(
  {
    ime: {
      type: String,
      required: true,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
      index: true,
    },
    locationLabel: { type: String, trim: true, default: '' },
    productName: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    capacity: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reportedByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true, collection: 'phone_issues' },
);

phoneIssueSchema.index({ ime: 1 }, { unique: true });

module.exports = mongoose.model('PhoneIssue', phoneIssueSchema);
