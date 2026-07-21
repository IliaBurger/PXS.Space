const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Инициализация базы данных SQLite
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Успешное подключение к базе данных SQLite.');
  }
});

// Создание базовых таблиц (например, для товаров/моделей)
db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Роуты
app.get('/api/assets', (req, res) => {
  db.all(`SELECT * FROM assets ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ assets: rows });
  });
});

app.post('/api/assets', (req, res) => {
  const { title, description, price, file_path } = req.body;
  const query = `INSERT INTO assets (title, description, price, file_path) VALUES (?, ?, ?, ?)`;
  
  db.run(query, [title, description, price, file_path], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: 'Объект успешно добавлен' });
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
