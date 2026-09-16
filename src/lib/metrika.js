// Яндекс.Метрика (https://metrika.yandex.ru/).
// Номер счётчика задаётся в .env.local как VITE_YM_COUNTER_ID.
// Важно: переменные Vite подставляются во время сборки — после правки .env.local
// нужно пересобрать проект (npm run build).
// Номер счётчика по умолчанию: нужен, чтобы счётчик работал и при сборке без
// .env.local (например, на сервере, где .env.local не хранится в git).
// Переменная окружения VITE_YM_COUNTER_ID имеет приоритет.
const FALLBACK_COUNTER_ID = 112711532

export const YM_COUNTER_ID = Number(
  import.meta.env.VITE_YM_COUNTER_ID || FALLBACK_COUNTER_ID,
)

// Скрипт Метрики должен загружаться ровно один раз, даже в React StrictMode.
let initialized = false

/** Загружает tag.js и инициализирует счётчик (если задан номер). */
export function initMetrika() {
  if (initialized || !YM_COUNTER_ID) return
  initialized = true

  if (!document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js"]')) {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://mc.yandex.ru/metrika/tag.js'
    document.head.appendChild(script)
  }

  // Очередь вызовов: пока скрипт не загрузился, ym лишь складывает аргументы.
  if (typeof window.ym !== 'function') {
    window.ym = function ymStub() {
      window.ym.a = window.ym.a || []
      window.ym.a.push(arguments)
    }
    window.ym.l = Date.now()
  }

  window.ym(YM_COUNTER_ID, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  })
}

/**
 * Отправляет просмотр страницы. Нужно вызывать при каждой смене маршрута:
 * SPA не перезагружает страницу, поэтому Метрика сама переходы не видит.
 */
export function trackMetrikaHit(url) {
  if (!YM_COUNTER_ID || typeof window.ym !== 'function') return
  window.ym(YM_COUNTER_ID, 'hit', url)
}