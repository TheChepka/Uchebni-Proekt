// backend/db_simple.js
// ПРОСТОЙ модуль для работы с SQLite базой данных
const sqlite3 = require('sqlite3').verbose();
// 1. Функция получить ВСЕ письма
function getAllLetters(callback) {
// Открываем файл базы данных
const db = new sqlite3.Database('./database/mail.db');
    // Выполняем SQL запрос с JOIN для получения имени отправителя
    // Сначала пытаемся найти по user_id, если не найдено - по email
    const sql = `SELECT l.*, 
    CASE 
        WHEN u1.full_name IS NOT NULL AND u1.full_name != '' THEN u1.full_name
        WHEN u1.email IS NOT NULL AND u1.email != '' THEN u1.email
        WHEN u2.full_name IS NOT NULL AND u2.full_name != '' THEN u2.full_name
        WHEN u2.email IS NOT NULL AND u2.email != '' THEN u2.email
        WHEN l.from_email IS NOT NULL AND l.from_email != '' THEN l.from_email
        ELSE 'Неизвестный отправитель'
    END as sender_name,
    COALESCE(u1.email, u2.email, l.from_email) as sender_email_from_user
    FROM letters l
    LEFT JOIN users u1 ON l.user_id = u1.id
    LEFT JOIN users u2 ON l.from_email = u2.email
    ORDER BY l.date DESC`;
db.all(sql, [], (error, rows) => {
if (error) {
console.error('❌ Ошибка чтения из БД:', error.message);
callback(error, null);
} else {
console.log(`✅ Прочитано писем из БД: ${rows.length}`);
// Отладочная информация для первых нескольких писем
if (rows.length > 0) {
    console.log('📧 Пример письма:', {
        id: rows[0].id,
        from_email: rows[0].from_email,
        sender_name: rows[0].sender_name,
        user_id: rows[0].user_id
    });
}
callback(null, rows);
}
// Закрываем соединение
db.close();
});
}
// 2. Функция получить ОДНО письмо по ID
function getLetterById(id, callback) {
const db = new sqlite3.Database('./database/mail.db');
const sql = `SELECT l.*, 
    CASE 
        WHEN u1.full_name IS NOT NULL AND u1.full_name != '' THEN u1.full_name
        WHEN u1.email IS NOT NULL AND u1.email != '' THEN u1.email
        WHEN u2.full_name IS NOT NULL AND u2.full_name != '' THEN u2.full_name
        WHEN u2.email IS NOT NULL AND u2.email != '' THEN u2.email
        WHEN l.from_email IS NOT NULL AND l.from_email != '' THEN l.from_email
        ELSE 'Неизвестный отправитель'
    END as sender_name,
    COALESCE(u1.email, u2.email, l.from_email) as sender_email_from_user
    FROM letters l
    LEFT JOIN users u1 ON l.user_id = u1.id
    LEFT JOIN users u2 ON l.from_email = u2.email
    WHERE l.id = ?`;
db.get(sql, [id], (error, row) => {
if (error) {
console.error(`❌ Ошибка чтения письма ${id}:`, error.message);
callback(error, null);
} else {
if (row) {
console.log(`✅ Найдено письмо: "${row.subject}"`);
} else {
console.log(` ✅ Письмо с ID ${id} не найдено`);
}
callback(null, row);
}
db.close();
});
}
// 3. Функция СОЗДАТЬ новое письмо
// 3. Функция СОЗДАТЬ новое письмо
function createLetter(letterData, callback) {
    console.log('='.repeat(40));
    console.log('🛠️  createLetter вызвана');
    console.log('Входные данные:', letterData);
    
    const db = new sqlite3.Database('./database/mail.db');
    
    // Подготовка данных для вставки
    // По умолчанию письма сохраняются в "Отправленные" (так как это отправка письма)
    // Если явно указана папка (например, "Черновики"), используем её
    const insertData = {
        folder: letterData.folder || 'Отправленные',
        to_email: letterData.to_email || '',
        subject: letterData.subject || 'Без темы',
        body: letterData.body || '',
        is_read: letterData.is_read !== undefined ? letterData.is_read : 1, // Отправленные письма помечаются как прочитанные
        date: letterData.date || new Date().toISOString(),
        from_email: letterData.from_email || letterData.sender_email || 'unknown@sender.com',
        user_id: letterData.user_id || null
    };
    
    console.log('📦 Данные для вставки:', insertData);
    
    // SQL запрос с from_email и user_id
    const sql = `
        INSERT INTO letters (folder, to_email, subject, body, is_read, date, from_email, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        insertData.folder,
        insertData.to_email,
        insertData.subject,
        insertData.body,
        insertData.is_read,
        insertData.date,
        insertData.from_email,
        insertData.user_id
    ];
    
    console.log('📋 SQL:', sql);
    console.log('📊 Значения:', values);
    
    db.run(sql, values, function(error) {
        if (error) {
            console.error('❌ ОШИБКА SQL:');
            console.error('Код:', error.code);
            console.error('Сообщение:', error.message);
            
            // Пробуем альтернативный запрос без user_id (если он NULL или не обязателен)
            console.log('🔄 Пробуем альтернативный запрос без user_id...');
            
            const altSql = `INSERT INTO letters (folder, to_email, subject, body, is_read, date, from_email)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const altValues = [
                insertData.folder,
                insertData.to_email,
                insertData.subject,
                insertData.body,
                insertData.is_read,
                insertData.date,
                insertData.from_email
            ];
            
            db.run(altSql, altValues, function(altError) {
                if (altError) {
                    console.error('❌ АЛЬТЕРНАТИВНАЯ ОШИБКА:', altError.message);
                    callback(altError, null);
                } else {
                    console.log(`✅ Альтернативная вставка успешна! ID: ${this.lastID}`);
                    callback(null, { 
                        id: this.lastID, 
                        ...insertData 
                    });
                }
                db.close();
            });
            
        } else {
            console.log(`✅ Успешная вставка! ID: ${this.lastID}`);
            callback(null, { 
                id: this.lastID, 
                ...insertData 
            });
            db.close();
        }
    });
}
// 4. Функция ОБНОВИТЬ письмо (прочитать или переместить)
function updateLetter(id,updates,callback){
    const db  = new sqlite3.Database('./database/mail.db');

    // Определяем что обновлено
    let sql, values;

    if (updates.is_read !==undefined){
        // Обновляем статус прочитанного
        sql = 'UPDATE letters SET is_read = ? WHERE id = ?';
        values =[updates.is_read ? 1:0,id];
    }else if (updates.folder){
        // Перемещаем в другую папку
        sql = 'UPDATE letters SET folder = ? WHERE id = ?';
        values = [updates.folder,id];
    }else{
        callback(new Error('Не указано что обновлять'), null);
        db.close();
        return;
    }
    db.run(sql, values, function(error){
        if (error){
            console.error(`❌Ошибка обновления письма ${id}:`,error.message);
            callback(error, null);
        }else if(this.changes ===0){
            // Ничего не обновилось (письмо не найдено)
            console.log(`⚠ Письмо ${id} не найдено для обновления`);
            callback(null,{updated:false});
        }else{
            console.log(`✅ Обновленно письмо ID:${id}`);
            callback(null,{
                updated:true,
                changes: this.changes,
                updates:updates

            });
        }
        db.close();
    });
}
//5. Функция "УДАЛИТЬ" письмо (переместить в корзину)
function deleteLetter(id, callback){
    const db = new sqlite3.Database('./database/mail.db');

    const sql ='UPDATE letters SET folder = ? WHERE id = ?';
    const values = ['Корзина', id];

    db.run(sql,values, function(error){
        if (error){
            console.error(`❌ Ошибка удаления письма ${id}:`, error.message);
            callback(error, null);
        }else if (this.changes === 0){
            console.log(`⚠ Письмо ${id} не найдено для удаления`);
            callback(null,{deleted:false});
        }else{
            console.log(`✅ Письмо ${id} перемещено в корзину`);
            callback(null,{
                deleted: true,
                changes: this.changes
            });
        }
        db.close();
    });
}
// 6 Функция для поиска по папке с пагинацией
function getLettersByFolder(folder,options ={}, callback){
    const db = new sqlite3.Database('./database/mail.db');

    let sql = `SELECT l.*, 
        CASE 
            WHEN u1.full_name IS NOT NULL AND u1.full_name != '' THEN u1.full_name
            WHEN u1.email IS NOT NULL AND u1.email != '' THEN u1.email
            WHEN u2.full_name IS NOT NULL AND u2.full_name != '' THEN u2.full_name
            WHEN u2.email IS NOT NULL AND u2.email != '' THEN u2.email
            WHEN l.from_email IS NOT NULL AND l.from_email != '' THEN l.from_email
            ELSE 'Неизвестный отправитель'
        END as sender_name,
        COALESCE(u1.email, u2.email, l.from_email) as sender_email_from_user
        FROM letters l
        LEFT JOIN users u1 ON l.user_id = u1.id
        LEFT JOIN users u2 ON l.from_email = u2.email
        WHERE l.folder = ?`;
    const values =[folder];

    // Сортировка 
    sql +=' ORDER BY l.date DESC';

    // Ограничение (пагинация)
    if(options.limit){
        sql += ' LIMIT ?';
        values.push(options.limit);

        if (options.offset){
            sql += ' OFFSET ?';
            values.push(options.offset)
        }
    }
    db.all(sql, values,(error, rows) =>{
        if(error){
            console.error(`❌ Ошибка получения писем из ${folder}:`,error.message);
            callback(error, null);
        }else{
            console.log(`✅ Найдено писем в ${folder}: ${rows.length}`);
            callback(null, rows);
        }
        db.close();
    });
}

// 7. Функция получить общее количество писем (для пагинации)
function getLettersCount(folder = null, callback) {
    const db = new sqlite3.Database('./database/mail.db');
    
    let sql = 'SELECT COUNT(*) as count FROM letters';
    const values = [];
    
    if (folder) {
        sql += ' WHERE folder = ?';
        values.push(folder);
    }
    
    db.get(sql, values, (error, row) => {
        if (error) {
            console.error('❌ Ошибка подсчета писем:', error.message);
            callback(error, null);
        } else {
            callback(null, row ? row.count : 0);
        }
        db.close();
    });
}

// 8 Экспортируем функуии для использования в server.js
module.exports ={
    getAllLetters,
    getLetterById,
    createLetter,
    updateLetter,
    deleteLetter,
    getLettersByFolder,
    getLettersCount
};
