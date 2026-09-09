import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, Link, useNavigate } from 'react-router-dom'
import Dashboard, { AuthScreen } from './Dashboard'
import ProfilePage from './ProfilePage'
import { TransitionProvider, TransitionLink } from './Transition'
import { referencePreviews } from './lib/mockData'
import './App.css'
import './Dashboard.css'

const heroPreviews = [
  '/forsite/img-1.jpg',
  '/forsite/img-2.jpg',
  '/forsite/img-3.jpg',
  '/forsite/img-4.jpg',
  '/forsite/variant-1-8.png',
  '/forsite/tg_image_613287012.jpeg',
]


const plans = [
  { name: 'Старт', price: '0', period: '/ навсегда', features: ['2 бесплатные генерации при регистрации', 'Базовые стили', 'Скачивание в PNG'], featured: false, cta: 'Начать бесплатно' },
  { name: 'Креатор', price: '890', period: '/ месяц', features: ['14 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false, cta: 'Попробовать' },
  { name: 'Блогер', price: '1390', period: '/ месяц', features: ['24 генерации (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: true, cta: 'Попробовать' },
  { name: 'Студия УЛЬТРАВЫГОДА', price: '2550', period: '/ месяц', features: ['60 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false, cta: 'Попробовать' },
]

function CompareSlider({ before, after, alt }) {
  const [pos, setPos] = useState(50)
  const ref = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    const onMove = (event) => {
      if (!dragging.current || !ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const clientX = event.touches ? event.touches[0].clientX : event.clientX
      const next = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      setPos(next)
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  return (
    <div ref={ref} className="compare" onMouseDown={() => { dragging.current = true }} onTouchStart={() => { dragging.current = true }}>
      <div className="compare__pane"><img src={before} alt={`${alt} до`} /></div>
      <div className="compare__pane compare__pane--after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={after} alt={`${alt} после`} />
      </div>
      <span className="compare__tag compare__tag--before">До</span>
      <span className="compare__tag compare__tag--after">После</span>
      <div className="compare__handle" style={{ left: `${pos}%` }} />
    </div>
  )
}

function Landing() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return !!localStorage.getItem('previewforge-current-user') } catch { return false }
  })

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        setIsAuthenticated(!!localStorage.getItem('previewforge-current-user'))
      } catch { /* ignore */ }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/" className="brand">
            <span className="brand__icon">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" fill="#04101d" /></svg>
            </span>
            PreviewGen
          </Link>
          <nav className="nav__links">
            <a href="#how">Начать генерировать</a>
            <a href="#examples">Примеры</a>
            <a href="#pricing">Тарифы</a>
          </nav>
          <div className="nav__right">
            <a href="https://t.me/PreviewGen" className="tg-badge" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c-.2 1.05-.788 1.482-1.338 1.545l-3.259.464s-1.303.172-2.606-.264c0 0-.49-.15-.49-1.05 0-.9.724-1.17.724-1.17l3.464-.49s1.506-.207 2.507 1.05c.5.75.5 1.5.5 1.5s.464 1.95-.464 2.85c-.928.9-2.85.9-2.85.9l-3.464.49s-1.05.15-1.656-.3c-.606-.45-1.05-1.2-.464-1.95.586-.75 2.408-1.05 2.408-1.05l3.464-.49s.928-.15.928-1.2c0-1.05-.928-1.05-.928-1.05s-.928 0-1.506.45c-.578.45-1.05.9-1.05 1.95 0 1.05.464 1.5.464 1.5l-1.506 1.95s-.464.6.464 1.05c.928.45 2.408 0 2.408 0l3.464-.49s1.506-.15 1.962-1.05c.464-.9.464-1.5.464-1.5s0-1.5-.464-1.95c-.464-.45-1.506-.45-1.506-.45l-3.464.49s-1.506.15-1.962-.45c-.464-.6 0-1.05 0-1.05l1.962-2.4s.464-.6 1.506-.45c1.05.15 1.506.6 1.506.6l.928 1.5s.464.6 0 1.2c-.464.6-1.506.9-1.506.9z"/></svg>
              <span>Мы в Telegram</span>
            </a>
            {isAuthenticated ? (
              <>
                <button type="button" className="tg-badge tg-badge--login" onClick={() => navigate('/profile')} aria-label="Профиль">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>Профиль</span>
                </button>
                <button type="button" className="tg-badge tg-badge--login" onClick={() => navigate('/studio')} aria-label="Студия">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  <span>Студия</span>
                </button>
              </>
            ) : (
              <button type="button" className="tg-badge tg-badge--login" onClick={() => setAuthModalOpen(true)} aria-label="Войти">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                <span>Войти</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero container">
          <span className="hero__eyebrow">AI-powered thumbnails</span>
          <h1 className="hero__title">
            Создавай обложки <span className="text-lime">за мгновения</span>
          </h1>
          <p className="hero__subtitle">
            Загрузи изображение, укажи понравившийся стиль — и получи готовое превью, которое выделит твоё видео среди остальных.
            Никаких долгих правок, сложного Photoshop и ожидания дизайнера.
          </p>
          <TransitionLink to="/studio" className="btn btn--primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAuthModalOpen(true); return false; }}>Попробовать бесплатно</TransitionLink>
        </section>

        <section className="marquee">
          <div className="marquee__track">
            {[...heroPreviews, ...heroPreviews].map((src, i) => (
              <div key={i} className="marquee__card"><img src={src} alt="" /></div>
            ))}
          </div>
        </section>

        <section className="container pain">
          <h2 className="pain__title">
            Делаешь такие <em>обложки</em><br />и ждёшь просмотры?
          </h2>
          <div className="pain__image">
            <img src="/maxresdefault.jpg" alt="Типичная обложка" />
          </div>
          <div className="pain__grid">
            <div className="pain-card">
              <div className="pain-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
              <h3>Тратишь часы</h3>
              <p>На поиск идей, исходников и вайба в фотостоках, вместо того чтобы снимать контент.</p>
            </div>
            <div className="pain-card">
              <div className="pain-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
              <h3>Платишь дизайнерам</h3>
              <p>Которые срывают сроки, не понимают ТЗ и требуют правки за каждый клик.</p>
            </div>
            <div className="pain-card">
              <div className="pain-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.3 2.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.3-2.7L3 16"/><path d="M3 21v-5h5"/></svg></div>
              <h3>Низкий CTR</h3>
              <p>Ролик не набирает просмотры из-за слабой обложки, и весь труд идёт насмарку.</p>
            </div>
          </div>
        </section>


        <section className="container section" id="examples">
          <div className="section__head">
            <h2 className="section__title">Примеры <span>генераций</span></h2>
            <p className="section__subtitle">Вдохновляйся готовыми стилями или загружай свой — нейросеть подстроится.</p>
          </div>
          <div className="marquee" style={{ marginBottom: 0 }}>
            <div className="marquee__track">
              {[...referencePreviews.map((r) => r.preview), ...referencePreviews.map((r) => r.preview)].map((src, i) => (
                <div key={i} className="marquee__card"><img src={src} alt="" /></div>
              ))}
            </div>
          </div>
        </section>

        <section className="container section" id="pricing">
          <div className="section__head">
            <h2 className="section__title">Тарифы</h2>
            <p className="section__subtitle">Выбери формат под себя — от хобби до студии.</p>
          </div>
          <div className="pricing">
            {plans.map((plan) => (
              <div key={plan.name} className={`plan ${plan.featured ? 'plan--featured' : ''}`}>
                {plan.featured && <span className="plan__badge">Хит</span>}
                <span className="plan__name">{plan.name}</span>
                <div className="plan__price">{plan.price} ₽<span>{plan.period}</span></div>
                <ul className="plan__features">
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <TransitionLink to="/studio" className={`btn ${plan.featured ? 'btn--accent' : 'btn--ghost'}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAuthModalOpen(true); return false; }}>{plan.cta}</TransitionLink>
              </div>
            ))}
          </div>
        </section>

        <section className="container section" id="how">
          <div className="cta__box">
            <h2 className="cta__title">Начать генерировать</h2>
            <p className="cta__text">Загрузите фото, выберите референс и получите готовые превью за секунды.</p>
            <TransitionLink to="/studio" className="btn btn--primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAuthModalOpen(true); return false; }}>Открыть студию</TransitionLink>
          </div>
        </section>

        <section className="container section" id="faq">
          <div className="section__head">
            <h2 className="section__title">Часто задаваемые <span>вопросы</span></h2>
            <p className="section__subtitle">Ответы на главные вопросы о токенах, тарифах и использовании сервиса</p>
          </div>
          <div className="faq-list">
            <details className="faq-item">
              <summary className="faq-question">Что такое токены и сколько стоит создание обложки?</summary>
              <div className="faq-answer">
                <p>Токены — это единицы баланса, с помощью которых вы оплачиваете генерации. Создание одной обложки для видео стоит 1 токен.</p>
              </div>
            </details>
            <details className="faq-item">
              <summary className="faq-question">Могу ли я сохранить токены на следующий месяц?</summary>
              <div className="faq-answer">
                <p>Токены, начисленные по ежемесячной подписке, действуют в пределах расчётного периода. Если подписка не продлена вовремя, оставшиеся токены сгорают.</p>
                <p>Расчётный месяц начинается в момент оформления подписки и заканчивается в ту же дату и время следующего календарного месяца.</p>
              </div>
            </details>
            <details className="faq-item">
              <summary className="faq-question">Что произойдёт с остатком токенов при продлении подписки?</summary>
              <div className="faq-answer">
                <p>Если подписка успешно продлевается автоматически или вручную, неиспользованные токены не пропадают. Они полностью прибавляются к новому начислению, поэтому вы продолжаете пользоваться накопленным балансом.</p>
              </div>
            </details>
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>© {new Date().getFullYear()} PreviewGen</span>
          <div className="footer__links">
            <a href="#how">Начать генерировать</a>
            <a href="#pricing">Тарифы</a>
            {isAuthenticated ? (
              <button type="button" className="tg-badge tg-badge--login" onClick={() => navigate('/profile')} aria-label="Профиль">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Профиль</span>
              </button>
            ) : (
              <button type="button" className="tg-badge tg-badge--login" onClick={() => setAuthModalOpen(true)} aria-label="Войти">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                <span>Войти</span>
              </button>
            )}
          </div>
        </div>
      </footer>
      {authModalOpen && (
        <div className="auth-overlay" onClick={() => setAuthModalOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <AuthScreen
              initialMode="login"
              onAuthenticated={() => {
                setAuthModalOpen(false)
                setTimeout(() => { window.location.replace('/studio') }, 150)
              }}
              onClose={() => setAuthModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TransitionProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/studio/*" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </TransitionProvider>
    </BrowserRouter>
  )
}

export default App
