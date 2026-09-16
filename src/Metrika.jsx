import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackMetrikaHit } from './lib/metrika'

/**
 * Сообщает Яндекс.Метрике о переходах между страницами внутри SPA.
 *
 * Сам счётчик (загрузка tag.js и init) подключён в index.html — он же отправляет
 * и первый просмотр, поэтому для первого рендера hit не дублируется.
 */
export default function MetrikaTracker() {
  const location = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackMetrikaHit(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}