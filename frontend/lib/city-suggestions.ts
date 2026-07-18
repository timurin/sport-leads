export const RUSSIAN_CITY_SUGGESTIONS = [
  "Архангельск",
  "Астрахань",
  "Барнаул",
  "Белгород",
  "Брянск",
  "Владивосток",
  "Владикавказ",
  "Владимир",
  "Волгоград",
  "Вологда",
  "Воронеж",
  "Екатеринбург",
  "Иваново",
  "Ижевск",
  "Иркутск",
  "Йошкар-Ола",
  "Казань",
  "Калининград",
  "Калуга",
  "Кемерово",
  "Киров",
  "Краснодар",
  "Красноярск",
  "Курган",
  "Курск",
  "Липецк",
  "Махачкала",
  "Москва",
  "Мурманск",
  "Набережные Челны",
  "Нижний Новгород",
  "Новосибирск",
  "Омск",
  "Оренбург",
  "Орёл",
  "Пенза",
  "Пермь",
  "Петрозаводск",
  "Псков",
  "Ростов-на-Дону",
  "Рязань",
  "Самара",
  "Санкт-Петербург",
  "Саранск",
  "Саратов",
  "Смоленск",
  "Сочи",
  "Ставрополь",
  "Сургут",
  "Тамбов",
  "Тверь",
  "Тольятти",
  "Томск",
  "Тула",
  "Тюмень",
  "Ульяновск",
  "Уфа",
  "Хабаровск",
  "Чебоксары",
  "Челябинск",
  "Череповец",
  "Якутск",
  "Ярославль",
] as const;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function getCitySuggestions(
  query: string,
  cities: readonly string[] = RUSSIAN_CITY_SUGGESTIONS,
  limit = 8,
) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2 || limit < 1) {
    return [];
  }

  return cities
    .map((city, index) => ({ city, index, normalized: normalize(city) }))
    .filter((item) => item.normalized.includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = left.normalized.startsWith(normalizedQuery);
      const rightStarts = right.normalized.startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }
      return left.index - right.index;
    })
    .slice(0, limit)
    .map((item) => item.city);
}
