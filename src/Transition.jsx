import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const TransitionContext = createContext({ trigger: () => {} })

export function usePageTransition() {
  return useContext(TransitionContext)
}

export function TransitionProvider({ children }) {
  const [phase, setPhase] = useState('idle')
  const [targetPath, setTargetPath] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const enterTimeoutRef = useRef(null)

  const trigger = useCallback((path) => {
    if (path === '/studio') {
      navigate(path)
      return
    }
    setTargetPath(path)
    setPhase('enter')
  }, [navigate])

  useEffect(() => {
    if (phase !== 'enter') return
    enterTimeoutRef.current = setTimeout(() => {
      setPhase('idle')
      navigate(targetPath)
      requestAnimationFrame(() => setPhase('exit'))
      setTimeout(() => setPhase('idle'), 650)
    }, 650)
    return () => clearTimeout(enterTimeoutRef.current)
  }, [phase, targetPath, navigate])

  useEffect(() => {
    // enter-studio transition removed to avoid blue screen on auth redirect
  }, [location.pathname])

  return (
    <TransitionContext.Provider value={{ trigger }}>
      {children}
      <div className={`page-transition ${phase}`} aria-hidden="true">
        <div className="page-transition__glow" />
        <div className="page-transition__sweep" />
        <div className="page-transition__core">
          <span className="page-transition__dot" />
          <span className="page-transition__dot" />
          <span className="page-transition__dot" />
        </div>
        <div className="page-transition__label">PreviewGen</div>
      </div>
    </TransitionContext.Provider>
  )
}

export function TransitionLink({ to, children, className, onClick }) {
  const { trigger } = usePageTransition()
  const handleClick = (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    const shouldNavigate = onClick?.(event) !== false
    if (shouldNavigate) {
      trigger(to)
    }
  }
  return (
    <Link to={to} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}