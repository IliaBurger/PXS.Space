const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создаем папку для загрузок, если её нет
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Настройка Multer для сохранения 3D файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// База данных SQLite
const db = new sqlite3.Database('./pxs.db', (err) => {
  if (err) console.error('Ошибка БД', err.message);
  else console.log('Подключено к SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  category TEXT,
  author TEXT,
  price REAL,
  file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.get('/api/assets', (req, res) => {
  db.all("SELECT * FROM assets ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Обработка загрузки файла и данных из админки
app.post('/api/assets', upload.single('modelFile'), (req, res) => {
  const { title, category, author, price } = req.body;
  const filePath = req.file ? `/uploads/${req.file.filename}` : '';

  const query = `INSERT INTO assets (title, category, author, price, file_path) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [title, category, author, price || 0, filePath], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, file_path: filePath });
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
