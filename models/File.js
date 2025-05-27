const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  files: [String],
  uuid: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', fileSchema);
