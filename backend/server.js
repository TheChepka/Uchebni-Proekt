// backend/server.js
// ДЕНЬ 6: ПОЛНЫЙ CRUD API с CORS настройками

const express = require('express');
const cors = require('cors');
const db = require('./db_simple.js');
const app = express();
const PORT = 3000;

// ======== MIDDLEWARE ========

// Настройки CORS для фронтенда на порту 5500 (Live Server)
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'], // порт фронтенда
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Обработка предварительных OPTIONS запросов
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', 'http://localhost:5500');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.status(200).end();
    } else {
        next();
    }
});

// Парсинг JSON
app.use(express.json());

// ======== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ========

// Валидация данных для создания письма
function validateLetterData(data) {
    const errors = [];

    if (!data.to_email || !data.to_email.includes('@')) {
        errors.push('Некорректный email получателя');
    }

    if (!data.subject || data.subject.trim().length < 2) {
        errors.push('Тема письма должна быть не короче 2 символов');
    }

    if (!data.body || data.body.trim().length < 5) {
        errors.push('Текст письма должен быть не короче 5 символов');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// ========== API ENDPOINTS ===========

// 1. ГЛАВНАЯ СТРАНИЦА (для проверки здоровья сервера)
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '📧 Почтовый клиент API v6.0',
        status: 'работает',
        date: new Date().toISOString(),
        features: [
            '✅ Чтение писем из БД',
            '✅ Создание новых писем',
            '✅ Обновление статуса',
            '✅ Удаление в корзину',
            '✅ Фильтрация по папкам',
            '✅ Валидация данных',
            '✅ CORS настроен для фронтенда'
        ],
        endpoints: [
            'GET /api/letters - все письма',
            'GET /api/letters/:id - письмо по ID',
            'POST /api/letters - создать письмо',
            'PATCH /api/letters/:id - обновить письмо',
            'DELETE /api/letters/:id - удалить в корзину',
            'GET /api/folders/:name - письма из папки'
        ]
    });
});

// 2. ПОЛУЧИТЬ ВСЕ ПИСЬМА (с фильтрацией по папке и пагинацией)
app.get('/api/letters', (req, res) => {
    const { folder, limit, offset, page } = req.query;
    
    // Вычисляем offset из page или используем переданный offset
    const pageSize = limit ? parseInt(limit) : 20;
    const currentPage = page ? parseInt(page) : 1;
    const calculatedOffset = offset ? parseInt(offset) : (currentPage - 1) * pageSize;

    console.log(`📨 Запрос писем${folder ? ` из папки "${folder}"` : ''} (страница ${currentPage}, размер ${pageSize})`);

    if (folder) {
        // Фильтрация по папке с пагинацией
        const options = { 
            limit: pageSize, 
            offset: calculatedOffset 
        };
        
        db.getLettersByFolder(folder, options, (error, letters) => {
            if (error) {
                console.error('Ошибка БД:', error);
                res.status(500).json({
                    success: false,
                    error: 'Ошибка получения писем из базы данных'
                });
            } else {
                // Получаем общее количество для пагинации
                db.getLettersCount(folder, (countError, totalCount) => {
                    if (countError) {
                        console.error('Ошибка подсчета:', countError);
                        totalCount = letters.length;
                    }
                    
                    res.json({
                        success: true,
                        folder: folder,
                        count: letters.length,
                        total: totalCount,
                        page: currentPage,
                        pageSize: pageSize,
                        totalPages: Math.ceil(totalCount / pageSize),
                        data: letters
                    });
                });
            }
        });
    } else {
        // Все письма - получаем все, затем применяем пагинацию
        db.getAllLetters((error, allLetters) => {
            if (error) {
                console.error('Ошибка БД:', error);
                res.status(500).json({
                    success: false,
                    error: 'Ошибка получения писем из базы данных'
                });
            } else {
                // Применяем пагинацию вручную
                const start = calculatedOffset;
                const end = start + pageSize;
                const paginatedLetters = allLetters.slice(start, end);
                
                db.getLettersCount(null, (countError, totalCount) => {
                    if (countError) {
                        totalCount = allLetters.length;
                    }
                    
                    res.json({
                        success: true,
                        count: paginatedLetters.length,
                        total: totalCount,
                        page: currentPage,
                        pageSize: pageSize,
                        totalPages: Math.ceil(totalCount / pageSize),
                        data: paginatedLetters
                    });
                });
            }
        });
    }
});

// 3. ПОЛУЧИТЬ ПИСЬМА ИЗ КОНКРЕТНОЙ ПАПКИ
app.get('/api/folders/:folderName', (req, res) => {
    const folderName = req.params.folderName;

    console.log(`📂 Запрос писем из папки: ${folderName}`);

    db.getLettersByFolder(folderName, {}, (error, letters) => {
        if (error) {
            console.error('Ошибка БД:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка получения писем из папки'
            });
        } else {
            // Подсчет непрочитанных
            const unread = letters.filter(l => l.is_read === 0).length;

            res.json({
                success: true,
                folder: folderName,
                count: letters.length,
                unread: unread,
                data: letters
            });
        }
    });
});

// 4. ПОЛУЧИТЬ ОДНО ПИСЬМО ПО ID
app.get('/api/letters/:id', (req, res) => {
    const id = parseInt(req.params.id);

    console.log(`🔍 Запрос письма ID: ${id}`);

    db.getLetterById(id, (error, letter) => {
        if (error) {
            console.error('Ошибка БД:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка базы данных при получении письма'
            });
        } else if (!letter) {
            res.status(404).json({
                success: false,
                error: `Письмо с ID ${id} не найдено`
            });
        } else {
            res.json({
                success: true,
                data: letter
            });
        }
    });
});

// 5. СОЗДАТЬ НОВОЕ ПИСЬМО (POST)
app.post('/api/letters', (req, res) => {
    console.log('📝 Запрос на создание письма');
    console.log('Данные:', req.body);

    // Валидация данных
    const validation = validateLetterData(req.body);

    if (!validation.isValid) {
        res.status(400).json({
            success: false,
            error: 'Ошибка валидации',
            details: validation.errors
        });
        return;
    }

    // Определяем from_email и user_id
    // Если не указаны, используем значения по умолчанию или ищем по to_email
    const letterData = {
        ...req.body,
        // Если from_email не указан, используем значение по умолчанию или ищем пользователя
        from_email: req.body.from_email || req.body.sender_email || 'system@college.ru',
        // Если user_id не указан, пытаемся найти пользователя по from_email
        user_id: req.body.user_id || null
    };

    // Если user_id не указан, пытаемся найти пользователя по from_email
    if (!letterData.user_id && letterData.from_email) {
        // Простая логика: ищем первого пользователя с таким email
        // В реальном приложении здесь должна быть проверка авторизации
        const sqlite3 = require('sqlite3').verbose();
        const tempDb = new sqlite3.Database('./database/mail.db');
        tempDb.get('SELECT id FROM users WHERE email = ?', [letterData.from_email], (err, user) => {
            if (!err && user) {
                letterData.user_id = user.id;
                console.log(`✅ Найден пользователь для ${letterData.from_email}, user_id: ${user.id}`);
            } else {
                // Если пользователь не найден, используем первого пользователя как отправителя по умолчанию
                tempDb.get('SELECT id FROM users LIMIT 1', [], (err2, defaultUser) => {
                    if (!err2 && defaultUser) {
                        letterData.user_id = defaultUser.id;
                        console.log(`ℹ️ Используется пользователь по умолчанию, user_id: ${defaultUser.id}`);
                    }
                    tempDb.close();
                    createLetterAndRespond();
                });
                return;
            }
            tempDb.close();
            createLetterAndRespond();
        });
    } else {
        createLetterAndRespond();
    }
    
    function createLetterAndRespond() {
        // Создаем письмо в БД
        db.createLetter(letterData, (error, result) => {
            if (error) {
                console.error('Ошибка БД:', error);
                res.status(500).json({
                    success: false,
                    error: 'Ошибка создания письма в БД'
                });
            } else {
                res.status(201).json({
                    success: true,
                    message: 'Письмо успешно создано',
                    data: result
                });
            }
        });
    }
});

// 6. ОБНОВИТЬ ПИСЬМО (PATCH)
app.patch('/api/letters/:id', (req, res) => {
    const id = parseInt(req.params.id);

    console.log(`✏️ Запрос обновления письма ID: ${id}`);
    console.log('Обновления:', req.body);

    // Проверяем, что есть что обновлять
    if (req.body.is_read === undefined && req.body.folder === undefined) {
        res.status(400).json({
            success: false,
            error: 'Укажите что обновлять: is_read или folder'
        });
        return;
    }

    // Обновляем письмо в БД
    db.updateLetter(id, req.body, (error, result) => {
        if (error) {
            console.error('Ошибка БД:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка обновления письма'
            });
        } else if (!result.updated) {
            res.status(404).json({
                success: false,
                error: `Письмо с ID ${id} не найдено`
            });
        } else {
            res.json({
                success: true,
                message: 'Письмо успешно обновлено',
                data: result
            });
        }
    });
});

// 7. УДАЛИТЬ ПИСЬМО (DELETE)
app.delete('/api/letters/:id', (req, res) => {
    const id = parseInt(req.params.id);

    console.log(`🗑️ Запрос удаления письма ID: ${id}`);

    db.deleteLetter(id, (error, result) => {
        if (error) {
            console.error('Ошибка БД:', error);
            res.status(500).json({
                success: false,
                error: 'Ошибка удаления письма'
            });
        } else if (!result.deleted) {
            res.status(404).json({
                success: false,
                error: `Письмо с ID ${id} не найдено`
            });
        } else {
            res.json({
                success: true,
                message: 'Письмо перемещено в корзину',
                data: result
            });
        }
    });
});

// ======== ОБРАБОТКА ОШИБОК ========

// Обработка 404 - маршрут не найден
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Маршрут ${req.method} ${req.url} не найден`
    });
});

// Обработка ошибок сервера
app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ======== ЗАПУСК СЕРВЕРА ========

app.listen(PORT, () => {
    console.log('══════════════════════════════════════════');
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log('📧 Почтовый клиент API v6.0 (День 6)');
    console.log('══════════════════════════════════════════');
    console.log('✅ Полный CRUD (создание, чтение, обновление, удаление)');
    console.log('✅ Валидация данных');
    console.log('✅ Фильтрация по папкам');
    console.log('✅ CORS настроен для фронтенда (порт 5500)');
    console.log('══════════════════════════════════════════');
    console.log('📋 Доступные эндпоинты:');
    console.log(`   GET  http://localhost:${PORT}/`);
    console.log(`   GET  http://localhost:${PORT}/api/letters`);
    console.log(`   GET  http://localhost:${PORT}/api/letters/1`);
    console.log(`   POST http://localhost:${PORT}/api/letters`);
    console.log(`   PATCH http://localhost:${PORT}/api/letters/1`);
    console.log(`   DELETE http://localhost:${PORT}/api/letters/1`);
    console.log(`   GET  http://localhost:${PORT}/api/folders/inbox`);
    console.log('══════════════════════════════════════════');
    console.log('⚠️  Убедитесь, что фронтенд запущен на http://localhost:5500');
    console.log('══════════════════════════════════════════');
});