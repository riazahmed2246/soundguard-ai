const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ─────────────────────────────────────────────────────────────
//  Ensure the uploads directory exists at startup
// ─────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
//  Allowed MIME types and extensions
// ─────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',         // .mp3
  'audio/mp3',          // .mp3 (alternate)
  'audio/wav',          // .wav
  'audio/x-wav',        // .wav (alternate)
  'audio/wave',         // .wav (alternate)
  'audio/flac',         // .flac
  'audio/x-flac',       // .flac (alternate)
  'audio/ogg',          // .ogg
  'audio/vorbis',       // .ogg (alternate)
  'audio/mp4',          // .m4a
  'audio/x-m4a',        // .m4a (alternate)
  'audio/aac',          // .m4a / .aac
]);

const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a']);

const MAX_FILE_SIZE_MB  = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─────────────────────────────────────────────────────────────
//  Disk storage — preserve original extension, unique filename
// ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (_req, file, cb) => {
    const ext        = path.extname(file.originalname).toLowerCase();
    const base       = path.basename(file.originalname, ext)
                           .replace(/[^a-zA-Z0-9_-]/g, '_') // sanitise
                           .slice(0, 60);                    // cap length
    const timestamp  = Date.now();
    const random     = Math.round(Math.random() * 1e6);
    cb(null, `${base}_${timestamp}_${random}${ext}`);
  },
});

// ─────────────────────────────────────────────────────────────
//  File filter — reject anything that isn't a supported audio file
// ─────────────────────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  const ext      = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(mimeType)) {
    cb(null, true);   // accept
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Unsupported file type "${ext || mimeType}". ` +
        `Allowed formats: ${[...ALLOWED_EXTENSIONS].join(', ')}`
      ),
      false             // reject
    );
  }
};

// ─────────────────────────────────────────────────────────────
//  Multer instance
// ─────────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  MAX_FILE_SIZE_BYTES,
    files:     1,          // one file per request
  },
});

// ─────────────────────────────────────────────────────────────
//  Single-file upload middleware + error wrapper
//  Usage in routes:  router.post('/upload', uploadSingle, handler)
// ─────────────────────────────────────────────────────────────
const uploadSingle = (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();

    // Multer-specific errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(415).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    // Any other error (e.g. file-filter rejection)
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed.',
    });
  });
};

module.exports = { uploadSingle, UPLOADS_DIR };