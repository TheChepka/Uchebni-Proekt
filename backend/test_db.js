const db = require("./db_simple.js");

console.log("🧪Тестируем подключение к БД...");

// Тест 1:Все письма
db.getAllLetters((err, letters) => {
  if (err) {
    console.error("Ошибка", err);
  } else {
    console.log("✔ Получено писем:", letters.length);

    // Тест 2: Одно письмо
    db.getLetterById(1, (err, letter) => {
      if (err) {
        console.error("Ошибка", err);
      } else if (letter) {
        console.log("✔ Письмо 1:", letter.subject);
      } else {
        console.log("❌ Письмо 1 не найдено");
      }
      console.log("🎉 Тест завершён!");
    });
  }
});
