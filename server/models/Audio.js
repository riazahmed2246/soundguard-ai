const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
//  Sub-schema: processing status & scores
// ─────────────────────────────────────────────────────────────
const processingSchema = new mongoose.Schema(
  {
    // Enhancement
    enhanced: {
      type:    Boolean,
      default: false,
    },
    enhancementModel: {
      type: String,
      enum: ['DEMUCS', 'CleanUNet', 'FullSubNet+', null],
      default: null,
    },

    // Audio Quality Index  (0 – 100)
    aqiScore: {
      type: Number,
      min:  0,
      max:  100,
      default: null,
    },

    // Tampering / Forensics  (0 – 100, higher = more authentic)
    authenticityScore: {
      type: Number,
      min:  0,
      max:  100,
      default: null,
    },
    tamperingDetected: {
      type:    Boolean,
      default: null,           // null = not yet analysed
    },
  },
  { _id: false }               // embedded sub-doc, no extra _id needed
);

// ─────────────────────────────────────────────────────────────
//  Sub-schema: raw results returned by each AI module
//  Using Schema.Types.Mixed so each service can store any JSON
// ─────────────────────────────────────────────────────────────
const resultsSchema = new mongoose.Schema(
  {
    // Module 1 — AI-Based Audio Enhancement
    enhancement: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Module 2 — Explainable Noise Removal
    explainability: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Module 3 — Audio Quality Index
    aqi: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Module 4 — Tampering Detection / Forensics
    forensics: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────
//  Main Audio schema
// ─────────────────────────────────────────────────────────────
const audioSchema = new mongoose.Schema(
  {
    // ── File identity ──────────────────────────────────────
    filename: {
      type:     String,
      required: [true, 'Filename is required'],
      trim:     true,
    },

    originalPath: {
      type:  String,
      trim:  true,
      default: null,
    },

    enhancedPath: {
      type:  String,
      trim:  true,
      default: null,
    },

    // ── Audio properties ───────────────────────────────────
    format: {
      type: String,
      trim: true,
      enum: {
        values:  ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', null],
        message: '{VALUE} is not a supported audio format',
      },
      default: null,
    },

    // Duration in seconds (e.g. 183.42)
    duration: {
      type: Number,
      min:  [0, 'Duration cannot be negative'],
      default: null,
    },

    // Sample rate in Hz (e.g. 44100, 48000)
    sampleRate: {
      type: Number,
      min:  [0, 'Sample rate cannot be negative'],
      default: null,
    },

    // 1 = Mono, 2 = Stereo, etc.
    channels: {
      type: Number,
      min:  [1, 'Channels must be at least 1'],
      max:  [8, 'Channels cannot exceed 8'],
      default: null,
    },

    // Raw file size in bytes
    fileSize: {
      type: Number,
      min:  [0, 'File size cannot be negative'],
      default: null,
    },

    // Bitrate in kbps (e.g. 320)
    bitrate: {
      type: Number,
      min:  [0, 'Bitrate cannot be negative'],
      default: null,
    },

    // ── Timestamps ─────────────────────────────────────────
    uploadDate: {
      type:    Date,
      default: Date.now,
      index:   true,           // index for sorting by upload date
    },

    // ── Embedded sub-documents ─────────────────────────────
    processing: {
      type:    processingSchema,
      default: () => ({}),     // always initialise with defaults
    },

    results: {
      type:    resultsSchema,
      default: () => ({}),
    },
  },
  {
    // Automatically add and maintain createdAt / updatedAt fields
    timestamps: true,

    // Return virtual fields (like `id`) when converting to JSON
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────
audioSchema.index({ uploadDate: -1 });                   // latest first
audioSchema.index({ 'processing.tamperingDetected': 1 }); // filter tampered files quickly
audioSchema.index({ 'processing.aqiScore': 1 });          // filter / sort by quality

// ─────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────

// Human-readable duration  →  "3:04"
audioSchema.virtual('durationFormatted').get(function () {
  if (this.duration == null) return null;
  const mins = Math.floor(this.duration / 60);
  const secs = Math.floor(this.duration % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
});

// Human-readable file size  →  "5.2 MB"
audioSchema.virtual('fileSizeFormatted').get(function () {
  if (this.fileSize == null) return null;
  if (this.fileSize < 1024)                          return `${this.fileSize} B`;
  if (this.fileSize < 1024 * 1024)                   return `${(this.fileSize / 1024).toFixed(1)} KB`;
  if (this.fileSize < 1024 * 1024 * 1024)            return `${(this.fileSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${(this.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

// Channel label  →  "Mono" | "Stereo" | "Surround (6ch)"
audioSchema.virtual('channelLabel').get(function () {
  if (this.channels == null) return null;
  if (this.channels === 1)   return 'Mono';
  if (this.channels === 2)   return 'Stereo';
  return `Surround (${this.channels}ch)`;
});

// AQI band label used by the frontend  →  "Good" | "Fair" | "Poor"
audioSchema.virtual('aqiBand').get(function () {
  const score = this.processing?.aqiScore;
  if (score == null)   return null;
  if (score >= 71)     return 'Good';
  if (score >= 41)     return 'Fair';
  return 'Poor';
});

// ─────────────────────────────────────────────────────────────
//  Instance methods
// ─────────────────────────────────────────────────────────────

// Mark the record as enhanced and store the enhanced file path
audioSchema.methods.markEnhanced = function (enhancedPath, modelName, metrics) {
  this.enhancedPath               = enhancedPath;
  this.processing.enhanced        = true;
  this.processing.enhancementModel = modelName;
  this.results.enhancement        = metrics || null;
  return this.save();
};

// Store AQI results
audioSchema.methods.saveAQI = function (score, detailedMetrics) {
  this.processing.aqiScore = score;
  this.results.aqi         = detailedMetrics || null;
  return this.save();
};

// Store forensics / tampering results
audioSchema.methods.saveForensics = function (authenticityScore, tampered, details) {
  this.processing.authenticityScore = authenticityScore;
  this.processing.tamperingDetected  = tampered;
  this.results.forensics             = details || null;
  return this.save();
};

// Store explainability results
audioSchema.methods.saveExplainability = function (data) {
  this.results.explainability = data || null;
  return this.save();
};

// ─────────────────────────────────────────────────────────────
//  Static methods
// ─────────────────────────────────────────────────────────────

// Fetch the most recent N uploads
audioSchema.statics.getRecent = function (limit = 10) {
  return this.find().sort({ uploadDate: -1 }).limit(limit);
};

// Find all records where tampering was detected
audioSchema.statics.getTampered = function () {
  return this.find({ 'processing.tamperingDetected': true }).sort({ uploadDate: -1 });
};

// ─────────────────────────────────────────────────────────────
//  Pre-save hook — keep format lowercase
// ─────────────────────────────────────────────────────────────
audioSchema.pre('save', function (next) {
  if (this.format) {
    this.format = this.format.toLowerCase();
  }
  next();
});

// ─────────────────────────────────────────────────────────────
//  Model export
// ─────────────────────────────────────────────────────────────
const Audio = mongoose.model('Audio', audioSchema);

module.exports = Audio;