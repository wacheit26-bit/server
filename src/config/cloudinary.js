const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Multer storage that uploads via Cloudinary SDK v2 (no multer-storage-cloudinary peer conflict). */
class CloudinaryMulterStorage {
  constructor({ cloudinary: cloudinaryClient, params }) {
    this.cloudinary = cloudinaryClient;
    this.params = params;
  }

  _handleFile(req, file, cb) {
    const uploadParams =
      typeof this.params === 'function' ? this.params(req, file) : { ...this.params };

    const stream = this.cloudinary.uploader.upload_stream(uploadParams, (error, result) => {
      if (error) return cb(error);
      cb(null, {
        path: result.secure_url,
        filename: result.public_id,
        public_id: result.public_id,
        secure_url: result.secure_url,
      });
    });
    file.stream.pipe(stream);
  }

  _removeFile(_req, _file, cb) {
    cb(null);
  }
}

const productStorage = new CloudinaryMulterStorage({
  cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
    format: 'jpg',
  },
});

const tempStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const name = String(file.originalname || '').toLowerCase();
  const rawMime = String(file.mimetype || '').toLowerCase();
  const mime = rawMime.split(';')[0].trim();

  const extOk = /\.(jpe?g|png|gif|webp)$/i.test(name);
  const mimeOk =
    /^image\/(jpeg|pjpeg|png|gif|webp)$/i.test(mime) ||
    mime === 'image/jpg' ||
    mime === 'image/x-png' ||
    mime === 'image/apng';
  const octetOk = mime === 'application/octet-stream' && extOk;

  if (mimeOk || extOk || octetOk) {
    return cb(null, true);
  }
  cb(
    new Error(
      'Only image files are allowed (JPEG, PNG, GIF, WebP). If your file is valid, try renaming it to end in .jpg, .png, or .webp.',
    ),
  );
};

const uploadProductImages = multer({
  storage: productStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const uploadMemory = multer({
  storage: tempStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  cloudinary,
  uploadProductImages,
  uploadMemory,
};
