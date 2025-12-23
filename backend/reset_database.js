// Скрипт для пересоздания базы данных с правильной структурой
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = './database/mail.db';
const dbBackupPath = './database/mail.db.backup';

console.log('🔄 Начинаем пересоздание базы данных...\n');

// Создаем резервную копию, если БД существует
if (fs.existsSync(dbPath)) {
    console.log('📦 Создаем резервную копию существующей БД...');
    try {
        fs.copyFileSync(dbPath, dbBackupPath);
        console.log('✅ Резервная копия создана: mail.db.backup');
    } catch (error) {
        console.error('⚠️ Не удалось создать резервную копию:', error.message);
    }
}

// Удаляем старую БД
if (fs.existsSync(dbPath)) {
    try {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Старая БД удалена');
    } catch (error) {
        console.error('❌ Ошибка удаления старой БД:', error.message);
        process.exit(1);
    }
}

// Создаем новую БД
const db = new sqlite3.Database(dbPath);

console.log('\n📝 Создаем таблицы...\n');

// Создание таблицы users
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (error) => {
    if (error) {
        console.error('❌ Ошибка создания таблицы users:', error.message);
    } else {
        console.log('✅ Таблица users создана');
    }
});

// Создание таблицы letters
db.run(`
    CREATE TABLE IF NOT EXISTS letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        folder VARCHAR(20) DEFAULT 'Входящие',
        from_email VARCHAR(100),
        to_email VARCHAR(100) NOT NULL,
        subject VARCHAR(200),
        body TEXT,
        is_read BOOLEAN DEFAULT 0,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`, (error) => {
    if (error) {
        console.error('❌ Ошибка создания таблицы letters:', error.message);
    } else {
        console.log('✅ Таблица letters создана');
    }
    
    // Добавляем тестовые данные
    console.log('\n📊 Добавляем тестовые данные...\n');
    
    // Добавляем пользователей
    db.run(`
        INSERT INTO users (email, password_hash, full_name) 
        VALUES ('admin@college.ru', 'admin', 'Администратор')
    `, function(err) {
        if (err && !err.message.includes('UNIQUE constraint')) {
            console.error('❌ Ошибка добавления пользователя:', err.message);
        } else {
            console.log('✅ Пользователь "Администратор" добавлен (ID: ' + this.lastID + ')');
        }
    });
    
    db.run(`
        INSERT INTO users (email, password_hash, full_name) 
        VALUES ('teacher@college.ru', 'teacher', 'Учитель Иванов')
    `, function(err) {
        if (err && !err.message.includes('UNIQUE constraint')) {
            console.error('❌ Ошибка добавления пользователя:', err.message);
        } else {
            console.log('✅ Пользователь "Учитель Иванов" добавлен (ID: ' + this.lastID + ')');
        }
    });
    
    db.run(`
        INSERT INTO users (email, password_hash, full_name) 
        VALUES ('student@college.ru', 'student', 'Студент Петров')
    `, function(err) {
        if (err && !err.message.includes('UNIQUE constraint')) {
            console.error('❌ Ошибка добавления пользователя:', err.message);
        } else {
            console.log('✅ Пользователь "Студент Петров" добавлен (ID: ' + this.lastID + ')');
        }
        
        // Добавляем тестовые письма
        setTimeout(() => {
            db.run(`
                INSERT INTO letters (folder, from_email, to_email, subject, body, is_read, user_id, date)
                VALUES ('Входящие', 'teacher@college.ru', 'student@college.ru', 
                        'Задание на практику', 'Выполните задание по программированию', 0, 2, datetime('now'))
            `, function(err) {
                if (err) {
                    console.error('❌ Ошибка добавления письма:', err.message);
                } else {
                    console.log('✅ Тестовое письмо 1 добавлено (ID: ' + this.lastID + ')');
                }
            });
            
            db.run(`
                INSERT INTO letters (folder, from_email, to_email, subject, body, is_read, user_id, date)
                VALUES ('Входящие', 'admin@college.ru', 'student@college.ru', 
                        'Важное объявление', 'Не забудьте сдать проект до конца недели', 0, 1, datetime('now', '-1 day'))
            `, function(err) {
                if (err) {
                    console.error('❌ Ошибка добавления письма:', err.message);
                } else {
                    console.log('✅ Тестовое письмо 2 добавлено (ID: ' + this.lastID + ')');
                }
            });
            
            db.run(`
                INSERT INTO letters (folder, from_email, to_email, subject, body, is_read, user_id, date)
                VALUES ('Отправленные', 'student@college.ru', 'teacher@college.ru', 
                        'Вопрос по заданию', 'Здравствуйте, у меня вопрос по практической работе', 1, 3, datetime('now', '-2 days'))
            `, function(err) {
                if (err) {
                    console.error('❌ Ошибка добавления письма:', err.message);
                } else {
                    console.log('✅ Тестовое письмо 3 добавлено (ID: ' + this.lastID + ')');
                }
                
                // Закрываем БД
                setTimeout(() => {
                    db.close((err) => {
                        if (err) {
                            console.error('❌ Ошибка закрытия БД:', err.message);
                        } else {
                            console.log('\n✅ База данных успешно пересоздана!');
                            console.log('📁 Резервная копия сохранена в: mail.db.backup');
                            console.log('\n🎉 Готово к использованию!');
                        }
                    });
                }, 500);
            });
        }, 500);
    });
});

