// frontend/js/config.js
// Конфигурация приложения

const Config = {
    // Базовый URL вашего API
    API_BASE_URL: 'http://localhost:3000/api',
    // Endpoints API
    API_ENDPOINTS: {
        LETTERS: '/letters',
        LETTER_BY_ID: '/letters/:id',
        FOLDERS: '/folders/:name'
    },
    // Настройки пагинации
    PAGINATION: {
        ITEMS_PER_PAGE: 20,
        DEFAULT_PAGE: 1
    },
    // Сообщения об ошибках (исправлено)
    ERROR_MESSAGES: {
        NETWORK_ERROR: 'Ошибка сети. Проверьте подключение к интернету.',
        SERVER_ERROR: 'Ошибка сервера. Попробуйте позже.',
        NOT_FOUND: 'Запрашиваемые данные не найдены.',
        UNKNOWN_ERROR: 'Произошла неизвестная ошибка.'
    },
    // Время кэширования (в миллисекундах)
    CACHE_TIME: 30000, // 30 секунд

    // Настройки запросов
    REQUEST_TIMEOUT: 10000, // 10 секунд
    RETRY_ATTEMPTS: 3, // Количество попыток при ошибке
    RETRY_DELAY: 1000 // Задержка между попытками (1 секунда)
};

export default Config;
