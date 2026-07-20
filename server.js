const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3001;

// Создаем папку uploads, если её нет
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});
const upload = multer({ storage: storage });

// Настройка базы данных SQLite
const dbFile = path.join(__dirname, 'pxs.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Ошибка подключения к БД:', err.message);
    else console.log('Подключено к базе данных SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        category TEXT,
        file_url TEXT,
        preview_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        user_token TEXT PRIMARY KEY,
        is_subscribed INTEGER DEFAULT 0
    )`);

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_token ON subscriptions(user_token)`);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Получение списка моделей с фильтрацией и поиском
app.get('/api/models', (req, res) => {
    let { category, search } = req.query;
    let query = `SELECT * FROM models WHERE 1=1`;
    let params = [];

    if (category && category !== 'All') {
        query += ` AND category = ?`;
        params.push(category);
    }

    if (search) {
        query += ` AND (title LIKE ? OR description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY id DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ models: rows });
    });
});

// API: Проверка статуса подписки пользователя
app.get('/api/subscription/:token', (req, res) => {
    const token = req.params.token;
    db.get(`SELECT is_subscribed FROM subscriptions WHERE user_token = ?`, [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ is_subscribed: row ? Boolean(row.is_subscribed) : false });
    });
});

// API: Сохранение/обновление статуса подписки
app.post('/api/subscription', (req, res) => {
    const { token, is_subscribed } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    db.run(
        `INSERT INTO subscriptions (user_token, is_subscribed) VALUES (?, ?) 
         ON CONFLICT(user_token) DO UPDATE SET is_subscribed = ?`,
        [token, is_subscribed ? 1 : 0, is_subscribed ? 1 : 0],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// API: Загрузка новой модели
app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'preview', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, description, category } = req.body;
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'Файл модели обязателен' });
        }

        const fileUrl = `/uploads/${req.files.file[0].filename}`;
        const previewUrl = req.files.preview ? `/uploads/${req.files.preview[0].filename}` : null;

        db.run(
            `INSERT INTO models (title, description, category, file_url, preview_url) VALUES (?, ?, ?, ?, ?)`,
            [title, description, category, fileUrl, previewUrl],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                io.emit('catalogUpdated');
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Удаление модели
app.delete('/api/models/:id', (req, res) => {
    const token = req.headers['authorization'];
    if (!token || token !== 'Bearer pxs_secure_token_abc123') {
        return res.status(403).json({ error: 'Доступ запрещен. Требуется авторизация.' });
    }

    const modelId = req.params.id;
    db.run(`DELETE FROM models WHERE id = ?`, [modelId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Модель не найдена' });

        io.emit('catalogUpdated');
        res.json({ success: true, message: 'Модель успешно удалена' });
    });
});

server.listen(PORT, () => {
    console.log(`Сервер PXS запущен: http://localhost:${PORT}`);
});