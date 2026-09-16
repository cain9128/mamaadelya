import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initMetrika, trackMetrikaHit } from './lib/metrika'

/**
 * Подключает Яндекс.Метрику и сообщает ей о переходах между страницами.
 *
 * Первый просмотр Метрика считает сама при инициализации счётчика, поэтому
 * для самого первого рендера hit не отправляется — иначе был бы двойной учёт.
 */
export default function MetrikaTracker() {
  const location = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    initMetrika()
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackMetrikaHit(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}