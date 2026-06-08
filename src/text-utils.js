export function normalizePersonName(name) {
  const normalizedInput = capitalizeWord(name.trim());
  const knownForms = {
    Маше: "Маша",
    Машей: "Маша",
    Маши: "Маша",
    Машу: "Маша",
    Ане: "Аня",
    Аней: "Аня",
    Аню: "Аня",
    Даше: "Даша",
    Дашей: "Даша",
    Дашу: "Даша",
    Кате: "Катя",
    Катей: "Катя",
    Катю: "Катя",
    Кати: "Катя",
    Оле: "Оля",
    Олей: "Оля",
    Олю: "Оля",
    Олегу: "Олег",
    Олега: "Олег",
    Олегом: "Олег",
    Олесей: "Олеся",
    Олесе: "Олеся",
    Олесю: "Олеся",
    Костей: "Костя",
    Косте: "Костя",
    Костю: "Костя",
    Кости: "Костя",
    Юле: "Юля",
    Юлей: "Юля",
    Юлю: "Юля",
    Тане: "Таня",
    Таней: "Таня",
    Таню: "Таня",
    Вере: "Вера",
    Верой: "Вера",
    Веру: "Вера",
    Диме: "Дима",
    Димой: "Дима",
    Димкой: "Дима",
    Димку: "Дима",
    Димке: "Дима",
    Димка: "Дима",
    Диму: "Дима",
    Ване: "Ваня",
    Ваней: "Ваня",
    Ваню: "Ваня",
    Вани: "Ваня",
    Марине: "Марина",
    Мариной: "Марина",
    Марину: "Марина",
    Марии: "Мария",
    Марией: "Мария",
    Марию: "Мария",
    Петру: "Петр",
    Петра: "Петр",
    Петей: "Петр",
    Пете: "Петр",
    Петику: "Петр",
    Петика: "Петр",
    Петиком: "Петр",
    Петик: "Петр",
    Ивану: "Иван",
    Ивана: "Иван",
    Иваном: "Иван",
    Сергею: "Сергей",
    Сергея: "Сергей",
    Сергеем: "Сергей",
    Алексею: "Алексей",
    Алексея: "Алексей",
    Анастасии: "Анастасия",
    Анастасией: "Анастасия",
    Анастасию: "Анастасия",
    Светой: "Света",
    Свете: "Света",
    Свету: "Света",
  };

  if (knownForms[normalizedInput]) return knownForms[normalizedInput];

  if (/[шжчщ]ей$/.test(normalizedInput)) return `${normalizedInput.slice(0, -2)}а`;
  if (/[шжчщ]е$/.test(normalizedInput)) return `${normalizedInput.slice(0, -1)}а`;
  if (/[шжчщ]у$/.test(normalizedInput)) return `${normalizedInput.slice(0, -1)}а`;
  if (/[а-яё]{4,}ой$/.test(normalizedInput)) return `${normalizedInput.slice(0, -2)}а`;
  if (/(иной|овой|евой|ёвой)$/.test(normalizedInput)) return `${normalizedInput.slice(0, -2)}а`;
  if (/(ину|ову|еву|ёву)$/.test(normalizedInput)) return `${normalizedInput.slice(0, -1)}а`;
  if (/(ину|ану)$/.test(normalizedInput)) return `${normalizedInput.slice(0, -1)}а`;
  if (/[а-яё]{4,}у$/.test(normalizedInput) && !/[её]у$/.test(normalizedInput)) return normalizedInput.slice(0, -1);

  return normalizedInput;
}

function capitalizeWord(word) {
  return word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : "";
}
