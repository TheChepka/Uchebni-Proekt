// frontend/js/app.js
// Главный файл приложения с динамической загрузкой данных

import api from './api.js'; 
// Глобальные переменные
let currentLetterId = null;
let currentFolder = 'inbox';
let allLetters = [];
let allLettersForStats = []; // Все письма для статистики
let currentPage = 1;
let totalPages = 1;
let pageSize = 20;
const LETTERS_PER_PAGE = 10;
let isLoading = false;

// Основная функция инициализации
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📧 Mail Client Frontend загружен');

    // Обновляем дату
    updateCurrentDate();

    // Проверяем сервер
    await checkServerStatus();

    // Инициализируем кнопки в шапке (отключаем по умолчанию)
    initializeHeaderButtons();

    // Настраиваем обработчики
    setupEventListeners();

    // Загружаем начальные данные
    await loadInitialData();
});

// Инициализация кнопок в шапке письма
function initializeHeaderButtons() {
    const replyBtnHeader = document.getElementById('reply-letter-btn-header');
    const forwardBtnHeader = document.getElementById('forward-letter-btn-header');
    const deleteBtnHeader = document.getElementById('delete-letter-btn-header');
    
    if (replyBtnHeader) {
        replyBtnHeader.disabled = true;
        replyBtnHeader.onclick = () => {
            showError('Выберите письмо для ответа');
        };
    }
    if (forwardBtnHeader) {
        forwardBtnHeader.disabled = true;
        forwardBtnHeader.onclick = () => {
            showError('Выберите письмо для пересылки');
        };
    }
    if (deleteBtnHeader) {
        deleteBtnHeader.disabled = true;
        deleteBtnHeader.onclick = () => {
            showError('Выберите письмо для удаления');
        };
    }
}

// Обновление даты в футере
function updateCurrentDate() {
    const now = new Date();
    const dateString = now.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('current-date').textContent = `Загружено: ${dateString}`;
}

async function checkServerStatus() {
    const statusElement = document.getElementById('server-status');

    try {
        // Пробуем любой существующий endpoint
        const response = await fetch('http://localhost:3000/api/letters');
        if (response.ok) {
            statusElement.innerHTML = '<i class="bi bi-check-circle me-1"></i>API онлайн';
            statusElement.className = 'badge bg-success';
            console.log('✔ API сервер доступен');
            return;
        }
        throw new Error('Сервер не отвечает');
    } catch (error) {
        statusElement.innerHTML = '<i class="bi bi-x-circle me-1"></i>API офлайн';
        statusElement.className = 'badge bg-danger';
        console.warn('⚠ API Сервер недоступен:', error.message);
        showError('Сервер API недоступен. Проверьте, запущен ли backend сервер.');
    }
}

// Настройка всех обработчиков событий
function setupEventListeners() {
    // 1. Клик по папке
    const folderItems = document.querySelectorAll('[data-folder]');
    folderItems.forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            const folder = this.getAttribute('data-folder');
            await selectFolder(folder, this);
        });
    });

    // 2. Кнопка "Новое письмо" (десктоп)
    const newLetterBtn = document.getElementById('new-letter-btn');
    if (newLetterBtn) {
        newLetterBtn.addEventListener('click', showNewLetterForm);
    }

    // 3. Кнопка "Новое письмо" (мобильная)
    const newLetterBtnMobile = document.getElementById('new-letter-btn-mobile');
    if (newLetterBtnMobile) {
        newLetterBtnMobile.addEventListener('click', showNewLetterForm);
    }

    // 4. Кнопка "Обновить"
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await refreshLetters();
        });
    }

    // 4.1. Кнопка "Фильтр"
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            showFilterMenu();
        });
    }

    // 5. Кнопка "Отмена" в форме нового письма
    const cancelBtn = document.getElementById('cancel-new-letter');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideNewLetterForm);
    }

    // 6. Поиск
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterLettersBySearch(this.value);
            }, 300); // Задержка 300 мс
        });
    }

    // 7. Обработка формы нового письма
    setupNewLetterForm();
    
}

// Загрузка начальных данных
async function loadInitialData() {
    showLoading('Загрузка писем...');

    try {
        // Загружаем все письма для статистики (без пагинации)
        const statsResponse = await api.getLetters(null, { limit: 10000 });
        if (statsResponse && statsResponse.success) {
            allLettersForStats = statsResponse.data;
        }
        
        // Загружаем письма с пагинацией
        const response = await api.getLetters(null, { page: currentPage, limit: pageSize });

        if (response && response.success) {
            allLetters = response.data;
            currentPage = response.page || 1;
            totalPages = response.totalPages || 1;

            // Отображаем письма
            displayLetters(allLetters);
            
            // Применяем сохраненный фильтр, если есть
            const savedFilter = sessionStorage.getItem('currentFilter');
            if (savedFilter && savedFilter !== 'all') {
                applyFilter(savedFilter);
            }
            
            // Обновляем пагинацию
            updatePagination(response);

            // Обновляем статистику из всех писем
            updateStatistics(allLettersForStats.length > 0 ? allLettersForStats : response.data);

            // Устанавливаем активной папку "Все письма"
            const allLettersFolder = document.querySelector('[data-folder="Все письма"]');
            if (allLettersFolder) {
                allLettersFolder.classList.add('active');
                // Снимаем активность с других папок
                document.querySelectorAll('[data-folder]').forEach(item => {
                    if (item !== allLettersFolder) {
                        item.classList.remove('active');
                    }
                });
                
                // ВАЖНО: Обновляем currentFolder
                currentFolder = 'Все письма'; // ИЛИ 'all' в зависимости от того, что использует ваша логика
                console.log('✅ Установлена активная папка: Все письма');
            }

            // Выбираем первое письмо, если есть
            if (allLetters.length > 0) {
                await selectLetter(allLetters[0].id);
            }

            hideLoading();
        } else {
            throw new Error('Неверный формат ответа сервера');
        }
    } catch (error) {
        console.error('Ошибка загрузки писем:', error);
        showError(`Не удалось загрузить письма: ${error.message}`);
        hideLoading();
    }
}

// Отображение списка писем
function displayLetters(letters) {
    const letterList = document.getElementById('letter-list');

    if (!letters || letters.length === 0) {
        letterList.innerHTML = `
        <div class="text-center py-5 text-muted">
            <i class="bi bi-envelope display-6"></i>
            <p class="mt-3 mb-0">Нет писем</p>
        </div>
        `;
        return;
    }

    // Очищаем список
    letterList.innerHTML = '';

    // Создаём элементы для каждого письма
    letters.forEach(letter => {
        const letterElement = createLetterElement(letter);
        letterList.appendChild(letterElement);

        // Добавляем обработчик клика
        letterElement.addEventListener('click', async () => {
            await selectLetter(letter.id, letterElement);
        });
    });
}

// Создание элемента письма для списка
function createLetterElement(letter) {
    const isUnread = letter.is_read === 0;
    const date = formatDate(letter.date || letter.created_at);
    // Используем sender_name из JOIN, если есть и не пустое
    let senderName = letter.sender_name;
    
    // Отладочная информация
    if (!senderName || senderName === 'null' || senderName.trim() === '') {
        console.log('⚠️ sender_name пустой для письма:', {
            id: letter.id,
            sender_name: letter.sender_name,
            from_email: letter.from_email,
            user_id: letter.user_id
        });
        senderName = letter.from_email || letter.sender_email || 'Неизвестный отправитель';
    }

    const element = document.createElement('a');
    element.href = '#';
    element.className = `list-group-item list-group-item-action ${isUnread ? 'unread' : ''}`;
    element.setAttribute('data-id', letter.id);

    element.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1 ${isUnread ? 'fw-bold': ''}">
                ${escapeHtml(senderName)}
            </h6>
            <small class="text-muted">${date}</small>
        </div>
        <p class="mb-1 ${isUnread ? 'fw-bold' : ''}">
            ${escapeHtml(letter.subject || 'Без темы')}
        </p>
        <small class="text-muted">
            ${escapeHtml(truncateText(letter.body || '', 80))}
        </small>
    `;

    return element;
}

// Выбор папки 
// Выбор папки 
async function selectFolder(folder, element) {
    console.log(`Выбрана папка: ${folder}`);
    
    // Обновляем currentFolder в зависимости от выбора
    if (folder === 'Все письма') {
        currentFolder = 'Все письма'; // или 'all', в зависимости от вашей логики
    } else {
        currentFolder = folder; // оставляем как есть для других папок
    }
    
    // СБРАСЫВАЕМ страницу при смене папки
    currentPage = 1;

    // Снимаем активность со всех папок
    document.querySelectorAll('[data-folder]').forEach(item => {
        item.classList.remove('active');
    });

    if (element) {
        element.classList.add('active');
    }

    // Если выбрана папка "Все письма", загружаем все письма без фильтра
    if (folder === 'Все письма' || folder === 'all') {
        await loadAllLetters();
    } else {
        // Загружаем письма из конкретной папки
        await loadLettersFromFolder(folder);
    }
}

// Загрузка всех писем (без фильтра по папке)
async function loadAllLetters() {
    showLoading('Загрузка всех писем...');

    try {
        // Загружаем все письма для статистики
        const statsResponse = await api.getLetters(null, { limit: 10000 });
        if (statsResponse && statsResponse.success) {
            allLettersForStats = statsResponse.data;
        }
        
        // Загружаем все письма с пагинацией
        const response = await api.getLetters(null, { page: currentPage, limit: pageSize });

        if (response && response.success) {
            allLetters = response.data;
            currentPage = response.page || 1;
            totalPages = response.totalPages || 1;
            
            displayLetters(allLetters);
            updatePagination(response);
            // Обновляем статистику из ВСЕХ писем
            updateStatistics(allLettersForStats.length > 0 ? allLettersForStats : []);

            // Сбрасываем выбранное письмо
            resetLetterSelection();

            hideLoading();
        }
    } catch (error) {
        console.error('Ошибка загрузки всех писем:', error);
        showError(`Не удалось загрузить письма: ${error.message}`);
        hideLoading();
    }
}

// Загрузка писем из папки
async function loadLettersFromFolder(folder) {
    showLoading(`Загрузка писем из папки "${getFolderName(folder)}"...`);

    try {
        // ВСЕГДА загружаем ВСЕ письма для статистики (без фильтра по папке)
        const statsResponse = await api.getLetters(null, { limit: 10000 });
        if (statsResponse && statsResponse.success) {
            allLettersForStats = statsResponse.data;
        }
        
        // Загружаем письма из выбранной папки с пагинацией
        currentPage = 1;
        const response = await api.getLetters(folder, { page: currentPage, limit: pageSize });

        if (response && response.success) {
            allLetters = response.data;
            currentPage = response.page || 1;
            totalPages = response.totalPages || 1;
            
            displayLetters(allLetters);
            updatePagination(response);
            // Обновляем статистику из ВСЕХ писем
            updateStatistics(allLettersForStats.length > 0 ? allLettersForStats : []);

            // Сбрасываем выбранное письмо
            resetLetterSelection();

            hideLoading();
        }
    } catch (error) {
        console.error(`Ошибка загрузки писем из папки ${folder}:`, error);
        showError(`Не удалось загрузить письма: ${error.message}`);
        hideLoading();
    }
}

// Выбор письма
async function selectLetter(letterId, element = null) {
    console.log(`Выбрано письмо ID: ${letterId}`);
    currentLetterId = letterId;

    // Снимаем выделение со всех писем
    document.querySelectorAll('.letter-list .list-group-item').forEach(item => {
        item.classList.remove('active-letter');
    });

    // Выделяем выбранное письмо
    if (element) {
        element.classList.add('active-letter');

        // Помечаем как прочитанное, если не прочитанное
        if (element.classList.contains('unread')) {
            await markAsRead(letterId, element);
        }
    }

    // Загружаем и отображаем содержимое письма
    await loadLetterContent(letterId);
}

// Загрузка содержимого письма
async function loadLetterContent(letterId) {
    showLoading('Загрузка письма...');

    try {
        const response = await api.getLetterById(letterId);

        if (response && response.success) {
            displayLetterContent(response.data);
            hideLoading();
        } else {
            throw new Error('Не удалось загрузить письмо');
        }
    } catch (error) {
        console.error(`Ошибка загрузки письма ${letterId}:`, error);
        showError(`Не удалось загрузить письмо: ${error.message}`);
        hideLoading();
    }
}

// Показать содержимое письма
function displayLetterContent(letter) {
    // Скрываем заглушку
    document.getElementById('no-letter-selected').style.display = 'none';

    // Показываем содержимое письма
    const contentElement = document.getElementById('letter-content');
    contentElement.style.display = 'block';
    
    // Включаем кнопки в шапке когда письмо выбрано
    const replyBtnHeader = document.getElementById('reply-letter-btn-header');
    const forwardBtnHeader = document.getElementById('forward-letter-btn-header');
    const deleteBtnHeader = document.getElementById('delete-letter-btn-header');
    
    if (replyBtnHeader) replyBtnHeader.disabled = false;
    if (forwardBtnHeader) forwardBtnHeader.disabled = false;
    if (deleteBtnHeader) deleteBtnHeader.disabled = false;

    // Используем sender_name из JOIN, если есть и не пустое
    let senderName = letter.sender_name;
    
    // Отладочная информация
    if (!senderName || senderName === 'null' || senderName.trim() === '') {
        console.log('⚠️ sender_name пустой в просмотре письма:', {
            id: letter.id,
            sender_name: letter.sender_name,
            from_email: letter.from_email,
            user_id: letter.user_id
        });
        senderName = letter.from_email || letter.sender_email || 'Неизвестный отправитель';
    }

    // Обновляем данные 
    document.getElementById('letter-subject').textContent = letter.subject || 'Без темы';
    document.getElementById('letter-from').textContent = senderName;
    document.getElementById('letter-to').textContent = letter.recipient_email || letter.to_email || 'Неизвестный получатель';
    document.getElementById('letter-date').textContent = formatDate(letter.date || letter.created_at);
    document.getElementById('letter-folder').textContent = getFolderName(letter.folder);
    document.getElementById('letter-body').textContent = letter.body || 'Текст письма отсутствует';

    // Обновляем бейджи
    updateLetterBadges(letter);

    // Настраиваем кнопки действия
    setupLetterActionButtons(letter);
}

// Пометить письмо как прочитанное
async function markAsRead(letterId, element) {
    try {
        await api.updateLetter(letterId, { is_read: 1 });

        // Обновляем внешний вид
        element.classList.remove('unread');
        element.querySelectorAll('.fw-bold').forEach(el => {
            el.classList.remove('fw-bold');
        });

        // Обновляем статистику
        await refreshStatistics();
    } catch (error) {
        console.error(`Ошибка при пометке письма ${letterId} как прочитанного:`, error);
    }
}

// Обновление статистики
function updateStatistics(letters) {
    if (!letters || letters.length === 0) {
        // Если нет писем, загружаем все для статистики
        refreshStatistics();
        return;
    }
    
    const total = letters.length;
    const unread = letters.filter(l => l.is_read === 0 || l.is_read === false).length;
    const inbox = letters.filter(l => l.folder === 'Входящие' || l.folder === 'inbox').length;
    const sent = letters.filter(l => l.folder === 'Отправленные' || l.folder === 'sent').length;
    const draft = letters.filter(l => l.folder === 'Черновики' || l.folder === 'draft').length;
    const trash = letters.filter(l => l.folder === 'Корзина' || l.folder === 'trash').length;

    // Обновляем счётчики в папках
    updateFolderCount('Все письма', total);
    updateFolderCount('Входящие', inbox);
    updateFolderCount('Отправленные', sent);
    updateFolderCount('Корзина', trash);
    updateFolderCount('Черновики', draft);

    // Обновляем общую статистику
    const statsElement = document.querySelector('.card.mt-3 .card-body');
    if (statsElement) {
        statsElement.innerHTML = `
            <p class="mb-1">Всего писем: <strong>${total}</strong></p>
            <p class="mb-1">Непрочитанных: <strong class="text-danger">${unread}</strong></p>
            <p class="mb-0">Отправлено: <strong>${sent}</strong></p>
            `;
    }
}

// Обновление счётчика папки
function updateFolderCount(folder, count) {
    const folderItem = document.querySelector(`[data-folder="${folder}"]`);
    const folderElement = folderItem ? folderItem.querySelector('.badge') : null;
    
    if (folderElement) {
        folderElement.textContent = count;
        
        // Проверяем, активна ли папка
        const isActive = folderItem && folderItem.classList.contains('active');
        
        if (isActive) {
            // Для активной папки используем светлый бейдж с белым текстом
            folderElement.className = 'badge float-end active-badge';
        } else {
            // Для неактивной папки используем стандартные цвета
            folderElement.className = count > 0 ? 'badge bg-primary float-end' : 'badge bg-secondary float-end';
        }
    }
}

// Обновление бейджей письма
function updateLetterBadges(letter) {
    const readBadge = document.getElementById('read-badge');
    const attachmentBadge = document.getElementById('attachment-badge');
    
    if (letter.is_read === 0) {
        readBadge.style.display = 'inline-block';
        readBadge.textContent = 'Непрочитано';
    } else {
        readBadge.style.display = 'none';
    }
    
    if (letter.has_attachment) {
        attachmentBadge.style.display = 'inline-block';
    } else {
        attachmentBadge.style.display = 'none';
    }
}

// Настройка кнопок действий для письма
function setupLetterActionButtons(letter) {
    // Кнопка "Ответить"
    const replyBtn = document.getElementById('reply-letter-btn');
    const replyBtnHeader = document.getElementById('reply-letter-btn-header');
    
    const handleReply = () => {
        // Проверяем, что письмо выбрано
        if (!letter || !letter.id) {
            showError('Выберите письмо для ответа');
            return;
        }
        
        showNewLetterForm();
        // Заполняем форму данными для ответа
        const toEmail = letter.from_email || letter.sender_email || letter.sender_email_from_user || '';
        const subject = letter.subject ? `Re: ${letter.subject}` : 'Re: Без темы';
        const body = `\n\n---\nОт: ${letter.from_email || letter.sender_email || 'Неизвестный отправитель'}\nДата: ${formatDate(letter.date || letter.created_at)}\nТема: ${letter.subject || 'Без темы'}\n\n${letter.body || ''}`;
        
        document.getElementById('new-to-email').value = toEmail;
        document.getElementById('new-subject').value = subject;
        document.getElementById('new-body').value = body;
        
        // Устанавливаем фокус на поле тела письма
        setTimeout(() => {
            const bodyField = document.getElementById('new-body');
            if (bodyField) {
                bodyField.focus();
                bodyField.setSelectionRange(0, 0);
            }
        }, 100);
    };
    
    if (replyBtn) {
        replyBtn.onclick = handleReply;
    }
    if (replyBtnHeader) {
        replyBtnHeader.onclick = handleReply;
        replyBtnHeader.disabled = false; // Включаем кнопку когда письмо выбрано
    }
    
    // Кнопка "Переслать"
    const forwardBtn = document.getElementById('forward-letter-btn');
    const forwardBtnHeader = document.getElementById('forward-letter-btn-header');
    
    const handleForward = () => {
        // Проверяем, что письмо выбрано
        if (!letter || !letter.id) {
            showError('Выберите письмо для пересылки');
            return;
        }
        
        showNewLetterForm();
        // Заполняем форму данными для пересылки
        const subject = letter.subject ? `Fwd: ${letter.subject}` : 'Fwd: Без темы';
        const body = `\n\n--- Пересланное письмо ---\nОт: ${letter.from_email || letter.sender_email || 'Неизвестный отправитель'}\nКому: ${letter.to_email || 'Неизвестный получатель'}\nДата: ${formatDate(letter.date || letter.created_at)}\nТема: ${letter.subject || 'Без темы'}\n\n${letter.body || ''}`;
        
        document.getElementById('new-to-email').value = '';
        document.getElementById('new-subject').value = subject;
        document.getElementById('new-body').value = body;
        
        // Устанавливаем фокус на поле "Кому"
        setTimeout(() => {
            const toField = document.getElementById('new-to-email');
            if (toField) {
                toField.focus();
            }
        }, 100);
    };
    
    if (forwardBtn) {
        forwardBtn.onclick = handleForward;
    }
    if (forwardBtnHeader) {
        forwardBtnHeader.onclick = handleForward;
        forwardBtnHeader.disabled = false; // Включаем кнопку когда письмо выбрано
    }
    
    // Кнопка "Удалить" (основная)
    const deleteBtn = document.getElementById('delete-letter-btn');
    const deleteBtnHeader = document.getElementById('delete-letter-btn-header');
    
    const handleDelete = async () => {
        // Проверяем, что письмо выбрано
        if (!letter || !letter.id) {
            showError('Выберите письмо для удаления');
            return;
        }
        
        if (confirm('Переместить письмо в корзину?')) {
            try {
                await api.deleteLetter(letter.id);
                showSuccess('Письмо перемещено в корзину');
                await refreshLetters();
                resetLetterSelection();
            } catch (error) {
                showError('Не удалось удалить письмо');
            }
        }
    };
    
    if (deleteBtn) {
        deleteBtn.onclick = handleDelete;
    }
    if (deleteBtnHeader) {
        deleteBtnHeader.onclick = handleDelete;
        deleteBtnHeader.disabled = false; // Включаем кнопку когда письмо выбрано
    }

    // Кнопка "Пометить как прочитанное/непрочитанное"
    const toggleReadBtn = document.getElementById('toggle-read-btn');
    if (toggleReadBtn) {
        toggleReadBtn.onclick = async () => {
            try {
                const currentStatus = letter.is_read === 0 || letter.is_read === false ? 0 : 1;
                const newStatus = currentStatus === 0 ? 1 : 0;
                
                showLoading('Обновление статуса...');
                const updateResponse = await api.updateLetter(letter.id, { is_read: newStatus });
                
                if (updateResponse && updateResponse.success) {
                    showSuccess(newStatus === 1 ? 'Письмо помечено как прочитанное' : 'Письмо помечено как непрочитанное');
                    
                    // Обновляем письмо в списке
                    await refreshLetters();
                    
                    // Перезагружаем содержимое письма
                    await loadLetterContent(letter.id);
                    
                    // Обновляем статистику
                    await refreshStatistics();
                } else {
                    throw new Error('Ошибка обновления');
                }
                hideLoading();
            } catch (error) {
                console.error('Ошибка обновления статуса:', error);
                showError('Не удалось обновить статус письма');
                hideLoading();
            }
        };
        
        // Обновляем текст кнопки
        const isUnread = letter.is_read === 0 || letter.is_read === false;
        toggleReadBtn.innerHTML = isUnread
            ? '<i class="bi bi-check-circle me-1"></i> Пометить прочитанным'
            : '<i class="bi bi-x-circle me-1"></i> Пометить непрочитанным';
    }
}
/*
    // Настройка кнопок действия для письма (2 вариант)
    function setupLetterActionButtons(letterId) {
        // Находим контейнер для кнопок
        const buttonContainer = document.querySelector('#letter-content .d-flex.gap-2');
        if (!buttonContainer) return;

        // Сохраняем кнопку "Ответить" если есть
        const replyBtn = buttonContainer.querySelector('.btn-primary');

        // Очишаем контейнер
        buttonContainer.innerHTML = '';

        // Добавляем кнопку "Ответить" обратно
        if (replyBtn) {
            buttonContainer.appendChild(replyBtn);
        }

        // Создаём новые кнопки
        
        // 1. Кнопка "Пометить как прочитанное/непрочитанное"
        const toggleReadBtn = document.createElement('button');
        toggleReadBtn.className = 'btn btn-outline-secondary';
        toggleReadBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Прочитано';
        toggleReadBtn.addEventListener('click', async () => {
            await toggleReadStatus(letterId);
        });
        buttonContainer.appendChild(toggleReadBtn);

        // 2. Кнопка "Переслать"
        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'btn btn-outline-primary';
        forwardBtn.innerHTML = '<i class="bi bi-forward me-1"></i> Переслать';
        forwardBtn.addEventListener('click', () => {
            // Пока просто показываем форму с заполненными данными
            showNewLetterForm();
            document.getElementById('new-subject').value = `Fwd: Письмо ${letterId}`;
        });

        // 3. Гибкая панель (пустой div для выравнивания)
        const spacer = document.createElement('div');
        spacer.className = 'ms-auto';
        buttonContainer.appendChild(spacer);

        // 4. Кнопка "Удалить" (ГЛАВНАЯ ДЛЯ ДНЯ 7)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outline-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash me-1"></i> Удалить';
        deleteBtn.addEventListener('click', () => {
            deleteLetter(letterId);
        });
        buttonContainer.appendChild(deleteBtn);

    }
*/
// Обновление всех писем
async function refreshLetters() {
    api.clearCacheForEndpoint('/letters');
    
    // ПРАВИЛЬНО определяем папку
    let folder = null;
    
    // Если это конкретная папка (не "Все письма")
    if (currentFolder !== 'Все письма' && currentFolder !== 'all') {
        folder = currentFolder;
    }
    // Для "Входящие" тоже передаем как папку
    else if (currentFolder === 'Входящие') {
        folder = 'inbox';
    }
    
    showLoading('Обновление писем...');
    try {
        // ВСЕГДА загружаем ВСЕ письма для статистики (без фильтра по папке)
        const statsResponse = await api.getLetters(null, { limit: 10000 });
        if (statsResponse && statsResponse.success) {
            allLettersForStats = statsResponse.data;
        }
        
        // Загружаем письма из текущей папки с пагинацией
        const response = await api.getLetters(folder, { page: currentPage, limit: pageSize });
        
        if (response && response.success) {
            allLetters = response.data;
            currentPage = response.page || 1;
            totalPages = response.totalPages || 1;
            
            displayLetters(allLetters);
            updatePagination(response);
            // Обновляем статистику из ВСЕХ писем
            updateStatistics(allLettersForStats.length > 0 ? allLettersForStats : []);
        }
        hideLoading();
    } catch (error) {
        console.error('Ошибка обновления писем:', error);
        showError(`Не удалось обновить письма: ${error.message}`);
        hideLoading();
    }
}



async function loadMoreLetters() {
    if (isLoading || !allLetters || allLetters.length === 0) return;
    
    isLoading = true;
    showLoading('Загрузка допольнительных писем...')

    try {
        currentPage++;
        const startIndex = (currentPage - 1) * LETTERS_PER_PAGE;
        const endIndex = startIndex + LETTERS_PER_PAGE;

        // Отображаем следующую порцию писем
        const lettersToShow = allLetters.slice(startIndex, endIndex);

        if (lettersToShow.length > 0) {
            displayLetters(lettersToShow);
            setupPagination();
        } else {
            showInfo('Все писмьа загружены');
        }
    } catch (error) {
        console.error('Ошибка загрузки писем:', error);
        showError('Не удалось загрузить письма');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Обновлённая функция отображения писем с пагинацией 
// function displayLettersWithPagination(letters) {
//     allLetters = letters;
//     currentPage = 1;

//     const startIndex = (currentPage - 1) * LETTERS_PER_PAGE;
//     const endIndex = startIndex + LETTERS_PER_PAGE;
//     const lettersToShow = allLetters.slice(startIndex, endIndex);

//     displayLetters(lettersToShow);
//     setupPagination();
// }

// function setupPagination() {
//     const totalPages = Math.ceil(allLetters.length / LETTERS_PER_PAGE);
//     const paginationContainer = document.querySelector('.pagination');

//     if (!paginationContainer) return;

//     if (totalPages <= 1) {
//         paginationContainer.style.display = "none";
//         return;
//     }

//     paginationContainer.style.display = 'flex';

//     let paginationHTML = `
//         <li class="page-item" ${currentPage === 1 ? 'disabled' : ''}">
//             <a class="page-link" href="#" id="prev-page">Назад</a>
//         </li>
//     `;

//     for (let i = 1; i <= Math.min(totalPages, 5); i++) {
//         paginationHTML += `
//             <li class="page-item ${currentPage === i ? 'active' : ''}">
//                 <a class="page-link page-number" href="#" data-page="${i}">${i}</a>
//             </li>
//         `;
//     }

//     if (totalPages > 5) {
//         paginationHTML += `
//             <li class="page-item disabled">
//                 <span class="page-link">...</span>
//             </li>
//             <li class="page-item">
//                 <a class="page-link page-number" href="#" data-page="${totalPages}">${totalPages}</a>
//             </li>
//         `;
//     }

//     paginationHTML +=`
//         <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
//             <a class="page-link" href="#" id="next-page">Вперёд</a>
//         </li>
//     `;

//     paginationContainer.innerHTML = paginationHTML;

//     // Обработчики событий
//     document.getElementById('prev-page')?.addEventListener('click', (e) => {
//         e.preventDefault();
//         if (currentPage > 1) {
//             currentPage--;
//             updateDisplayedLetters();
//         }
//     });

//     document.getElementById('next-page')?.addEventListener('click', (e) => {
//         e.preventDefault();
//         if (currentPage < totalPages) {
//             currentPage ++;
//             updateDisplayedLetters();
//         }
//     });

//     document.querySelectorAll('.page-number').forEach(link => {
//         link.addEventListener('click', (e) => {
//             e.preventDefault();
//             const page = parseInt(e.target.dataset.page);
//             if (page !== currentPage) {
//                 currentPage = page;
//                 updateDisplayedLetters();
//             }
//         });
//     });
// }

// function updateDisplayedLetters() {
//     const startIndex = (currentPage - 1) * LETTERS_PER_PAGE;
//     const endIndex = startIndex + LETTERS_PER_PAGE;
//     const lettersToShow = allLetters.slice(startIndex, endIndex);

//     displayLetters(lettersToShow);
//     setupPagination();
// }

// Обновление статистики
async function refreshStatistics() {
    try {
        // Загружаем все письма для статистики (без пагинации)
        const response = await api.getLetters(null, { limit: 10000 });
        if (response && response.success) {
            allLettersForStats = response.data;
            updateStatistics(response.data);
        }
    } catch (error) {
        console.error('Ошибка обновления статистики:', error);
    }
}

// Сброс выбранного письма
function resetLetterSelection() {
    currentLetterId = null;
    document.getElementById('no-letter-selected').style.display = 'block';
    document.getElementById('letter-content').style.display = 'none';

    document.querySelectorAll('.letter-list .list-group-item').forEach(item => {
        item.classList.remove('active-letter');
    });
    
    // Отключаем кнопки в шапке когда письмо не выбрано
    const replyBtnHeader = document.getElementById('reply-letter-btn-header');
    const forwardBtnHeader = document.getElementById('forward-letter-btn-header');
    const deleteBtnHeader = document.getElementById('delete-letter-btn-header');
    
    if (replyBtnHeader) {
        replyBtnHeader.disabled = true;
        replyBtnHeader.onclick = () => {
            showError('Выберите письмо для ответа');
        };
    }
    if (forwardBtnHeader) {
        forwardBtnHeader.disabled = true;
        forwardBtnHeader.onclick = () => {
            showError('Выберите письмо для пересылки');
        };
    }
    if (deleteBtnHeader) {
        deleteBtnHeader.disabled = true;
        deleteBtnHeader.onclick = () => {
            showError('Выберите письмо для удаления');
        };
    }
}




// Функция показа формы нового письма
window.showNewLetterForm = function() {
    const form = document.getElementById('new-letter-form');
    if (form) {
        form.classList.add('active');
        const formElement = document.getElementById('newLetterForm');
        if (formElement) {
        const firstInput = document.getElementById('new-to-email');
        if (firstInput) {
            formElement.reset();
        }
            firstInput.focus();
        }
    }
}

// Функция скрытия формы нового письма
window.hideNewLetterForm = function() {
    const form = document.getElementById('new-letter-form');
    if (form) {
        form.classList.remove('active');
    }
}

// Обработка клика по кнопкам "Новое письмо"
document.addEventListener('DOMContentLoaded', function() {
    // Кнопка в десктопной версии
    const composeBtn = document.getElementById('new-letter-btn');
    if (composeBtn) {
        composeBtn.addEventListener('click', showNewLetterForm);
    }
    
    // Кнопка в мобильной версии
    const composeBtnMobile = document.getElementById('new-letter-btn-mobile');
    if (composeBtnMobile) {
        composeBtnMobile.addEventListener('click', function() {
            showNewLetterForm();
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu) {
                const bsCollapse = new bootstrap.Collapse(mobileMenu, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        });
    }
    
    // Закрытие формы при нажатии ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideNewLetterForm();
        }
    });
});

// Фильтрация писем по поиску
function filterLettersBySearch(searchTerm) {
    if (!searchTerm.trim()) {
        // Если поиск пустой, показываем все письма с учетом фильтра
        const savedFilter = sessionStorage.getItem('currentFilter');
        if (savedFilter && savedFilter !== 'all') {
            applyFilter(savedFilter);
        } else {
            displayLetters(allLetters);
        }
        return;
    }

    const filtered = allLetters.filter(letter => {
        const searchLower = searchTerm.toLowerCase();
        const senderName = letter.sender_name || letter.from_email || letter.sender_email || '';
        return (
            (letter.subject && letter.subject.toLowerCase().includes(searchLower)) || 
            (letter.body && letter.body.toLowerCase().includes(searchLower)) || 
            (letter.from_email && letter.from_email.toLowerCase().includes(searchLower)) || 
            (letter.sender_email && letter.sender_email.toLowerCase().includes(searchLower)) ||
            (senderName && senderName.toLowerCase().includes(searchLower)) ||
            (letter.to_email && letter.to_email.toLowerCase().includes(searchLower))
        );
    });

    displayLetters(filtered);
}

// Показать меню фильтра
function showFilterMenu() {
    const currentFilter = sessionStorage.getItem('currentFilter') || 'all';
    
    let filterText = 'Все письма';
    const filterMap = {
        'all': 'Все письма',
        'unread': 'Непрочитанные',
        'read': 'Прочитанные',
        'attachments': 'С вложениями'
    };
    filterText = filterMap[currentFilter] || 'Все письма';

    const choice = confirm(`Текущий фильтр: ${filterText}\n\nВыберите фильтр:\n1. OK - Непрочитанные\n2. Отмена - Все письма`);
    
    if (choice) {
        applyFilter('unread');
    } else {
        applyFilter('all');
    }
}

// Применить фильтр
function applyFilter(filterType) {
    sessionStorage.setItem('currentFilter', filterType);
    
    let filtered = allLetters;
    
    switch(filterType) {
        case 'unread':
            filtered = allLetters.filter(l => l.is_read === 0 || l.is_read === false);
            break;
        case 'read':
            filtered = allLetters.filter(l => l.is_read === 1 || l.is_read === true);
            break;
        case 'attachments':
            filtered = allLetters.filter(l => l.has_attachment === true || l.has_attachment === 1);
            break;
        case 'all':
        default:
            filtered = allLetters;
            break;
    }
    
    displayLetters(filtered);
    
    const filterMap = {
        'all': 'Все письма',
        'unread': 'Непрочитанные',
        'read': 'Прочитанные',
        'attachments': 'С вложениями'
    };
    showSuccess(`Применен фильтр: ${filterMap[filterType] || 'Все письма'}`);
}

// ======== ОБРАБОТКА ФОРМЫ НОВОГО ПИСЬМА ========

function setupNewLetterForm() {
    const form = document.getElementById('newLetterForm');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                to_email: document.getElementById('new-to-email').value,
                subject: document.getElementById('new-subject').value,
                body: document.getElementById('new-body').value,
                folder: 'Отправленные' // Явно указываем папку "Отправленные"
            };
            
            // Валидация
            if (!formData.to_email || !formData.subject || !formData.body) {
                showError('Заполните все поля');
                return;
            }
            
            try {
                const result = await api.createLetter(formData);
                if (result.success) {
                    showSuccess('Письмо успешно отправлено!');
                    hideNewLetterForm();
                    await refreshLetters();
                }
            } catch (error) {
                showError(`Ошибка отправки: ${error.message}`);
            }
        });
    }
    
    if (saveDraftBtn) {
saveDraftBtn.addEventListener('click', async function() {
    const toEmail = document.getElementById('new-to-email').value.trim();
    const subject = document.getElementById('new-subject').value.trim();
    const body = document.getElementById('new-body').value.trim();

    // Для черновика все поля не обязательны
    const letterData = {
        to_email: toEmail || '',
        subject: subject || 'Черновик',
        body: body || '',
        folder: 'Черновики',
        is_read: 1
    };
    
    console.log('🔍 Данные для сохранения черновика:', letterData);
    console.log('🔍 Тип данных:');
    console.log('- to_email:', typeof toEmail, 'значение:', toEmail);
    console.log('- subject:', typeof subject, 'значение:', subject);
    console.log('- body:', typeof body, 'значение:', body);
    console.log('- folder:', typeof 'Черновики', 'значение:', 'Черновик');

    showLoading('Сохранение черновика...');

    try {
        console.log('📤 Отправка запроса на сервер...');
        const response = await api.createLetter(letterData);
        console.log('📥 Ответ сервера:', response);
        
        if (response && response.success) {
            showSuccess('Черновик сохранён');
            
            // Очищаем форму
            document.getElementById('new-to-email').value = '';
            document.getElementById('new-subject').value = '';
            document.getElementById('new-body').value = '';
            
            // Скрываем форму
            const form = document.getElementById('new-letter-form');
            if (form) {
                form.classList.remove('active');
            }
            
            // Очищаем кэш и обновляем письма
            setTimeout(async () => {
                api.clearCacheForEndpoint('/letters');
                await refreshLetters();
                
                // Переходим в папку "Черновик"
                const draftFolder = document.querySelector('[data-folder="Черновики"]');
                if (draftFolder) {
                    await selectFolder('Черновики', draftFolder);
                }
            }, 500);
            
        } else {
            console.error('❌ Сервер вернул ошибку:', response);
            showError(response?.error || 'Ошибка сохранения черновика');
        }
    } catch (error) {
        console.error('❌ Исключение при сохранении черновика:', error);
        console.error('❌ Stack trace:', error.stack);
        showError(`Не удалось сохранить черновик: ${error.message}`);
    } finally {
        hideLoading();
    }
});
    }
}

// Очистка формы нового письма
function clearNewLetterForm() {
    document.getElementById('new-to-email').value = '';
    document.getElementById('new-subject').value = '';
    document.getElementById('new-body').value = '';
}

// ======== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ========

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return 'Без даты';

    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Если сегодня
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Если вчера
    if (diff < 48 * 60 * 60 * 1000) {
        return 'Вчера';
    }

    // Если на этой неделе
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[date.getDay()];
    }

    // Более недели назад 
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Получение имени папки
function getFolderName(folderKey) {
    const folders = {
        'inbox': 'Входящие',
        'sent': 'Отправленные',
        'draft': 'Черновики',
        'trash': 'Корзина'
    };

    return folders[folderKey] || folderKey;
}

// Обрезка текста
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Показать сообщение об ошибке
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
    errorDiv.style.zIndex = '9999';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(errorDiv);

    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Показать сообщение об успехе
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 end-0 m-3';
    successDiv.style.zIndex = '9999';
    successDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

// Показать индикатор загрузки
function showLoading(message = 'Загрузка...') {
    // Создаём или находим индикатор загрузки
    let loader = document.getElementById('global-loader');

    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'position-fixed top-50 start-50 translate-middle';
        loader.innerHTML = `
            <div class="d-flex align-items-center bg-white p-3 rounded shadow">
                <div class="spinner-border text-primary me-3" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <div>${message}</div>
            </div>
        `;

        loader.style.zIndex = '99999';
        document.body.appendChild(loader);
    } else {
        loader.querySelector('div:last-child').textContent = message;
        loader.style.display = 'block';
    }
}

// Скрыть индикатор загрузки
function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}


// Переключение статуса прочитанности
async function toggleReadStatus(letterId) {
    // Сначала получаем текущее письмо, чтобы узнать его статус
    try {
        const response = await api.getLetterById(letterId);
        if (response && response.success) {
            const currentLetter = response.data;
            const newStatus = currentLetter.is_read === 0 ? 1 : 0;

            showLoading('Обновление статуса...');

            const updateResponse = await api.updateLetter(letterId, {
                is_read: newStatus
            });

            if (updateResponse && updateResponse.success) {
                showSuccess(newStatus === 1 ? 
                    'Письмо помечено как прочитанное' :
                    'Письмо помечено как непрочитанное');

                // Обновляем текущее письмо
                await loadLetterContent(letterId);

                // Обновляем список писем
                api.clearCacheForEndpoint('/letters');
                await refreshLetters();

                // Обновляем статистику
                await refreshStatistics();
            }
        }
    } catch (error) {
        console.error(`Ошибка подключения статуса письма ${letterId}`, error);
        showError('Не удалось изменить статус письма');
    } finally {
        hideLoading();
    }
}

// Удаление письма (перемещение в корзину)
async function deleteLetter(letterId) {
    if (!letterId) {
        showError('Не выбрано письмо для удаления');
        return;
    }

    // Подтверждение удаления
    if (!confirm('Вы уверены, что хотите удалить это письмо? Оно будет перемещено в корзину.')) {
        return;
    }

    showLoading();

    try {
        // Отправляем DELETE запрос
        const response = await api.deleteLetter(letterId);

        if (response && response.success) {
            showSuccess('Письмо перемещено в корзину');

            // Очищаем кэш и обновляем список
            api.clearCacheForEndpoint('/letters');
            await refreshLetters();

            // Сбрасываем выбранное письмо
            resetLetterSelection();

            // Обновляем статистику
            await refreshStatistics();

            // Если мы находимся в папке "Корзина", обновляем её
            if (currentFolder === 'trash') {
                await loadLettersFromFolder('trash');
            }
        } else {
            throw new Error(response.error || 'Ошибка удаления');
        }
    } catch (error) {
        console.error(`Ошибка удаления письма ${letterId}:`, error);
        showError(`Не удалось удалить письмо: ${error.message}`);
    } finally {
        hideLoading();
    }
}

console.group('Финальное тестирование');
console.log('1. Загрузка приложения:', typeof api !== 'undefined');
console.log('2. Загрузка писем:', allLetters.length > 0);
console.log('3. Форма нового письма:', document.getElementById('new-letter-form') !== null);
console.groupEnd();


// ======== ПАГИНАЦИЯ ========

// Обновление пагинации
function updatePagination(response) {
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) return;

    const page = response.page || 1;
    let totalPages = response.totalPages || 1;
    const total = response.total || 0;
    
    // Исправление: Если totalPages = 0, устанавливаем 1
    if (totalPages <= 0) {
        totalPages = 1;
    }

    if (totalPages <= 1) {
        paginationElement.innerHTML = '<li class="page-item disabled"><span class="page-link">1</span></li>';
        return;
    }

    let html = '';

    // Кнопка "Назад"
    if (page > 1) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${page - 1}" aria-label="Предыдущая">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
    } else {
        html += `
            <li class="page-item disabled">
                <span class="page-link" aria-label="Предыдущая">
                    <i class="bi bi-chevron-left"></i>
                </span>
            </li>
        `;
    }

    // Номера страниц
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Первая страница
    if (startPage > 1) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `;
        if (startPage > 2) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    // Основные страницы
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }

    // Последняя страница
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }

    // Кнопка "Вперёд"
    if (page < totalPages) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${page + 1}" aria-label="Следующая">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
    } else {
        html += `
            <li class="page-item disabled">
                <span class="page-link" aria-label="Следующая">
                    <i class="bi bi-chevron-right"></i>
                </span>
            </li>
        `;
    }

    // Информация о странице
    html += `
        <li class="page-item text-muted ms-2">
            <span class="page-link">
                ${page} из ${totalPages}
            </span>
        </li>
    `;

    paginationElement.innerHTML = html;

    // Обработчики кликов
    setupPaginationHandlers(paginationElement);
}

// Функция для настройки обработчиков
function setupPaginationHandlers(paginationElement) {
    paginationElement.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetPage = parseInt(this.getAttribute('data-page'));
            if (targetPage >= 1) {
                await goToPage(targetPage);
            }
        });
    });
}

// Функция перехода на страницу
async function goToPage(page) {
    if (isLoading) return;
    
    isLoading = true;
    const folder = currentFolder === 'Все письма' || currentFolder === 'all' ? null : currentFolder;
    
    showLoading(`Загрузка страницы ${page}...`);

    try {
        const response = await api.getLetters(folder, { 
            page: page, 
            limit: pageSize 
        });

        if (response && response.success) {
            // Если данных нет И мы не на первой странице - возвращаемся на первую
            if (!response.data || response.data.length === 0) {
                if (page > 1) {
                    showError('На этой странице нет писем');
                    await goToPage(1);
                    return;
                }
            }
            
            allLetters = response.data;
            currentPage = page;
            totalPages = response.totalPages || 1;

            // Обновляем список писем
            displayLetters(allLetters);
            
            // Обновляем пагинацию
            updatePagination(response);
            
            // Сбрасываем выбранное письмо если его нет на текущей странице
            if (currentLetterId && !allLetters.some(l => l.id === currentLetterId)) {
                resetLetterSelection();
            }

            hideLoading();
        }
    } catch (error) {
        console.error(`Ошибка загрузки страницы ${page}:`, error);
        showError(`Не удалось загрузить страницу: ${error.message}`);
        hideLoading();
    } finally {
        isLoading = false;
    }
}