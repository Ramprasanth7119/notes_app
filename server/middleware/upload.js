const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const { AppError } = require('../utils/AppError');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB, as stated in the UI

// Both the extension and the declared MIME type must be on this list and
// agree with each other. The stored file keeps the (allow-listed) extension,
// which is what decides how it is served back (see noteController.getFile).
const ALLOWED_TYPES = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function(req, file, cb) {
    // Random server-side name: the client's filename never becomes a path.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_TYPES[extension]?.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new AppError(
    415,
    'UNSUPPORTED_FILE_TYPE',
    'Allowed file types: PNG, JPEG, GIF, WebP, PDF, TXT, DOC, DOCX'
  ));
};

const upload = multer({
  storage,
  fileFilter,
  // busboy rejects a file that *reaches* fileSize, so +1 allows exactly 5 MB.
  limits: { fileSize: MAX_FILE_SIZE + 1, files: 1 }
});

module.exports = { upload, MAX_FILE_SIZE };
