// frontend/js/api.js
// Модуль для работы с API почтового клиента

import Config from './config.js';

class MailAPI {
    constructor() {
        this.baseUrl = Config.API_BASE_URL;
        this.cache = new Map(); // Простое кэширование
        this.requestQueue = new Map(); // Очередь запросов
    }

    /*
    * Общая функция для выполнения HTTP запросов
    * @param {string} endpoint - Endpoint API
    * @param {Object} options - опции fetch
    * @return {Promise} Promise с данными
    */


    async fetchData(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const cacheKey = `${url}_${JSON.stringify(options)}`;

        // Проверка кэша
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < Config.CACHE_TIME) {
            console.log(`📦 Используем кэш для: ${endpoint}`);
            return cached.data;
        }

        // Проверка группировки запросов
        async function batchRequests(endpoints) {
        const promises = endpoints.map(endpoint => this.fetchData(enpoints));
        return Promise.all(promises);
        }

        // Проверка дублирующихся запросов
        const isDuplicate = this.requestQueue.has(cacheKey);
        if (isDuplicate) {
            console.log(`📦 Испоьзуем существующий запрос: ${endpoint}`);
            return this.requestQueue.get(cacheKey)
        }


        // Настройки запроса
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const fetchOptions = { ...defaultOptions, ...options };

        console.log(`📡 Запрос к API: ${fetchOptions.method} ${url}`);

        try {
            // Создаём таймаут для запроса
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Config.REQUEST_TIMEOUT);
            fetchOptions.signal = controller.signal;

            // Выполняем запрос
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            // Проверяем статус ответа
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Парсим JSON ответ
            const data = await response.json();

            // Проверяем структуру ответа
            if (data && data.success !== undefined) {
                if (data.success) {
                    // Сохраняем в кэш
                    this.cache.set(cacheKey, {
                        data: data,
                        timestamp: Date.now()
                    });

                    console.log(`✅ Успешный ответ от: ${endpoint}`);
                    return data;
                } else {
                    throw new Error(data.error || 'Ошибка API');
                }
            }

            return data;
        } catch (error) {
            console.error(`❌ Ошибка запроса ${endpoint}:`, error.message);

            // Обработка различных ошибок
            let errorMessage = Config.ERROR_MESSAGES.UNKNOWN_ERROR;

            if (error.name === 'AbortError') {
                errorMessage = 'Таймаут запроса. Сервер не отвечает.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = Config.ERROR_MESSAGES.NETWORK_ERROR;
            } else if (error.message.includes('HTTP 5')) {
                errorMessage = Config.ERROR_MESSAGES.SERVER_ERROR;
            } else if (error.message.includes('HTTP 4')) {
                errorMessage = Config.ERROR_MESSAGES.NOT_FOUND;
            }

            throw new Error(errorMessage);
        }
    }

    
    /*
    * Получить все письма
    * @param {string} folder - папка для фильтрации (опционально)
    * @param {Object} options - опции пагинации { page, limit, offset }
    * @returns {Promise} Promise с письмами
    */
    async getLetters(folder = null, options = {}) {
        let endpoint = Config.API_ENDPOINTS.LETTERS;
        const params = [];

        if (folder) {
            params.push(`folder=${encodeURIComponent(folder)}`);
        }

        if (options.page) {
            params.push(`page=${options.page}`);
        }

        if (options.limit) {
            params.push(`limit=${options.limit}`);
        }

        if (options.offset) {
            params.push(`offset=${options.offset}`);
        }

        if (params.length > 0) {
            endpoint += `?${params.join('&')}`;
        }

        return await this.fetchData(endpoint);
    }

    
    /*
    * Получить одно письмо по ID (ДОБАВЛЕН отсутствующий метод!)
    * @param {number|string} id - ID письма
    * @returns {Promise} Promise с письмом
    */
    async getLetterById(id) {
        const endpoint = Config.API_ENDPOINTS.LETTER_BY_ID.replace(':id', id);
        return await this.fetchData(endpoint);
    }

    /*
    * Создать новое письмо
    * @param {Object} letterData - Данные письма
    * @returns {Promise} Promise с результатом
    */
    async createLetter(letterData) {
        const endpoint = Config.API_ENDPOINTS.LETTERS;

        const options = {
            method: 'POST',
            body: JSON.stringify(letterData)
        };

        return await this.fetchData(endpoint, options);
    }

    /*
    * Обновить письмо
    * @param {number|string} id - ID письма
    * @param {Object} updates - Данные для обновления
    * @returns {Promise} Promise с результатом
    */
    async updateLetter(id, updates) {
        const endpoint = Config.API_ENDPOINTS.LETTER_BY_ID.replace(':id', id);

        const options = {
            method: 'PATCH',
            body: JSON.stringify(updates)
        };

        return await this.fetchData(endpoint, options);
    }

    /*
    * Удалить письмо (переместить в корзину)
    * @param {number|string} id - ID письма
    * @returns {Promise} Promise с результатом
    */
    async deleteLetter(id) {
        const endpoint = Config.API_ENDPOINTS.LETTER_BY_ID.replace(':id', id);

        const options = {
            method: 'DELETE'
        };

        return await this.fetchData(endpoint, options);
    }

    /*
    * Получить письма из определённой папки
    * @param {string} folderName - Название папки
    * @returns {Promise} Promise с результатом
    */
    async getLettersByFolder(folderName) {
        const endpoint = Config.API_ENDPOINTS.FOLDERS.replace(':name', folderName);
        return await this.fetchData(endpoint);
    }

    /*
    * Проверить доступность сервера
    * @returns {Promise<boolean>} true если сервер доступен
    */
    async checkServerHealth() {
        try {
            await this.fetchData('/');
            return true;
        } catch (error) {
            return false;
        }
    }

    /* 
    * Очистить кэш
    */
    clearCache() {
        this.cache.clear();
        console.log(`🧹 Кэш очищен`);
    }

    /*
    * Очистить кэш для конкретного endpoint
    * @param {string} endpoint - Endpoint для очистки
    */
    clearCacheForEndpoint(endpoint) {
        for (const [key] of this.cache) {
            if (key.startsWith(`${this.baseUrl}${endpoint}`)) {
                this.cache.delete(key);
            }
        }
        console.log(`🧹 Кэш очищен для: ${endpoint}`);
    };
}


// Создаем и экспортируем экземпляр API
const api = new MailAPI();
export default api;
