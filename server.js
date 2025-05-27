require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const File = require('./models/File');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB connected"));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: true
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Home page
app.get('/', (req, res) => {
  res.render('index', { link: null, qr: null });
});

// Upload and render same page with download info
app.post('/upload', upload.array('files'), async (req, res) => {
  const uuid = uuidv4();
  const filenames = req.files.map(f => f.filename);
  const file = new File({ uuid, files: filenames });
  await file.save();

  const downloadLink = `${process.env.BASE_URL}/download/${uuid}`;
  const qrCode = await QRCode.toDataURL(downloadLink);

  res.render('index', { link: downloadLink, qr: qrCode });
});

// Show list of direct file links
app.get('/download/:uuid', async (req, res) => {
  const record = await File.findOne({ uuid: req.params.uuid });
  if (!record) return res.status(404).send('Files not found.');

  let html = `<div style="text-align:center;"><h2>Download Files</h2>`;
  record.files.forEach(f => {
    html += `<p><a href="/file/${f}" download>${f}</a></p>`;
  });
  html += `</div>`;
  res.send(html);
});

// Serve individual file
app.get('/file/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found.');
  }
});

// Admin Login (GET)
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) {
    File.find().sort({ createdAt: -1 }).then(files => {
      res.render('admin', { files });
    });
  } else {
    res.send(`
      <form method="POST" action="/admin" style="text-align:center;margin-top:100px;">
        <h2>Admin Login</h2>
        <input type="password" name="password" placeholder="Admin Password" required />
        <br><br>
        <button type="submit">Login</button>
      </form>
    `);
  }
});

// Admin Login (POST)
app.post('/admin', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('<p style="text-align:center;color:red;">Wrong password</p>');
  }
});

// Admin Delete
app.post('/admin/delete/:uuid', async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send('Unauthorized');
  const file = await File.findOne({ uuid: req.params.uuid });
  if (file) {
    file.files.forEach(f => {
      const filePath = path.join(__dirname, 'public/uploads', f);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    await File.deleteOne({ uuid: req.params.uuid });
  }
  res.redirect('/admin');
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

