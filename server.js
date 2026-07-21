const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware для чтения JSON
app.use(express.json());

// Раздаем статические файлы прямо из корневой папки репозитория (__dirname)
app.use(express.static(__dirname));

// Инициализация базы данных SQLite
const db = new sqlite3.Database('./pxs.db', (err) => {
  if (err) console.error('Ошибка подключения к БД', err.message);
  else console.log('Подключено к базе данных SQLite.');
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

// API получения моделей
app.get('/api/assets', (req, res) => {
  db.all("SELECT * FROM assets ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// API добавления модели (для админки)
app.post('/api/assets', (req, res) => {
  const { title, category, author, price, file_path } = req.body;
  const query = `INSERT INTO assets (title, category, author, price, file_path) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [title, category, author, price || 0, file_path || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
