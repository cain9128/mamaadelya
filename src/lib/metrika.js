// Яндекс.Метрика (https://metrika.yandex.ru/).
//
// Основной код счётчика (загрузка tag.js и вызов init) подключён в index.html —
// как рекомендует Яндекс: в <head>, ближе к началу страницы, чтобы данные о
// просмотре уходили даже если посетитель сразу закроет сайт.
//
// Здесь только отправка просмотров при переходах внутри SPA: React Router не
// перезагружает страницу, поэтому сама по себе Метрика переходы не видит.
//
// ВАЖНО: номер счётчика должен совпадать с номером в index.html.
const FALLBACK_COUNTER_ID = 112711532

export const YM_COUNTER_ID = Number(
  import.meta.env.VITE_YM_COUNTER_ID || FALLBACK_COUNTER_ID,
)

/**
 * Сообщает Метрике о просмотре страницы при переходе внутри сайта (SPA).
 * Первый просмотр отправляет код счётчика из index.html — дублировать не нужно.
 */
export function trackMetrikaHit(url) {
  if (!YM_COUNTER_ID || typeof window.ym !== 'function') return
  window.ym(YM_COUNTER_ID, 'hit', url)
}