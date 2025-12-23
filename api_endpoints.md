# 🔗 API ENDPOINTS

## БАЗОВЫЙ URL

https://localhost:3000/api

## 📋 ТАБЛИЦА ENDPOINTS

| Метод      | URL             | Описание                  | Параметры                            |
| ---------- | --------------- | ------------------------- | ------------------------------------ |
| **GET**    | `/letters`      | Получить все письма       | `?folder=inbox` <br> `?search=текст` |
| **GET**    | `/letters/{id}` | Получисть одно письмо     | `id` - номер письма                  |
| **POST**   | `/letters`      | Создать новое письмо      | `{to, subject, body}`                |
| **PATCH**  | `/letters/{id}` | Обновить письмо           | `{is_read: true}`                    |
| **DELETE** | `/letters/{id}` | Удалить в корзину         | `id` - номер письма                  |
| **GET**    | `/folders`      | Получить папки и счётчики | нет                                  |

## 📝ПОДРОБНОЕ ОПИСАНИЕ

### 1. GET /letters

**получить список писем**

Пример запроса: GET http://localhost:3000/api/letters?folder=inbox

Пример ответа:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "from": "teacher@school.ru",
      "subject": "Задание",
      "body": "Сделать проект...",
      "date": "2024-05-20",
      "is_read": false
    }
  ]
}
```

### 2. GET /letters/{id}

**Получить одно письмо**

Пример: GET http://localhost:3000/api/letters/1

### 3. POST /letters

**Отправить письмо**

Тело запроса:

```json
{
  "to": "friend@mail.ru",
  "subject": "Привет!",
  "body": "Как дела?"
}
```

### 4. PATCH /letters/{id}

**Обновить письмо**

Пример (пометить прочитанным):

```json
{
  "is_read": true
}
```

### 5. DELETE /letters/{id}

**Удалить корзину**

Пример:

> DELETE http://localhost:3000/api/letters/5
