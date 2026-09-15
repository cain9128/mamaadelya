import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, Link, useNavigate } from 'react-router-dom'
import Dashboard, { AuthScreen } from './Dashboard'
import ProfilePage from './ProfilePage'
import { TransitionProvider, TransitionLink } from './Transition'
import { OfferPage, PrivacyPage } from './LegalPages'
import { LEGAL } from './lib/legal'
import './App.css'
import './Dashboard.css'

// Верхняя лента: /forsite/img-*. Не менять.
const heroPreviews = [
  '/forsite/img-1.jpg',
  '/forsite/img-2.jpg',
  '/forsite/img-3.jpg',
  '/forsite/img-4.jpg',
  '/forsite/img-5.jpg',
  '/forsite/img-6.jpg',
  '/forsite/img-7.jpg',
  '/forsite/img-8.jpg',
  '/forsite/img-9.jpg',
  '/forsite/img-10.jpg',
  '/forsite/img-11.jpg',
]

// Нижняя лента под «Примеры генераций»: только /forsite-copy/* (из «forsite копия»).
// Независимый набор файлов, независимая анимация.
const examplesPreviews = [
  '/forsite-copy/copy-1.jpg',
  '/forsite-copy/copy-2.jpg',
  '/forsite-copy/copy-3.jpg',
  '/forsite-copy/copy-4.jpg',
  '/forsite-copy/copy-5.jpg',
  '/forsite-copy/copy-6.jpg',
  '/forsite-copy/copy-7.jpg',
  '/forsite-copy/copy-8.jpg',
  '/forsite-copy/copy-9.jpg',
  '/forsite-copy/copy-10.jpg',
  '/forsite-copy/copy-11.jpg',
]

const generatedExamples = examplesPreviews.slice(0, 10)

function HeroMarquee() {
  // Верхняя лента: только /forsite/img-*, своя разметка и своя анимация hero-scroll.
  // Две идентичные половины внутри одного трека, сдвиг ровно на половину — бесшовный круг.
  const half = [...heroPreviews, ...heroPreviews]
  return (
    <div className="hero-marquee">
      <div className="hero-marquee__track">
        {[0, 1].map((halfIndex) => (
          <div key={halfIndex} className="hero-marquee__half" aria-hidden={halfIndex === 1}>
            {half.map((src) => (
              <div key={`${halfIndex}-${src}`} className="hero-marquee__card">
                <img src={src} alt="" decoding="async" draggable={false} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ExamplesMarquee() {
  // Нижняя лента под «Примеры генераций»: только /forsite-copy/* (из «forsite копия»),
  // своя разметка и своя анимация examples-scroll. С верхней никак не связана.
  const half = [...examplesPreviews, ...examplesPreviews]
  return (
    <div className="examples-marquee">
      <div className="examples-marquee__track">
        {[0, 1].map((halfIndex) => (
          <div key={halfIndex} className="examples-marquee__half" aria-hidden={halfIndex === 1}>
            {half.map((src) => (
              <div key={`${halfIndex}-${src}`} className="examples-marquee__card">
                <img src={src} alt="" decoding="async" draggable={false} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}


const plans = [
  { id: 'start', name: 'Старт', price: 0, credits: 2, period: '/ навсегда', features: ['2 бесплатные генерации при регистрации', 'Базовые стили', 'Скачивание в PNG'], featured: false, cta: 'Начать бесплатно' },
  { id: 'test', name: 'Тест', price: 10, credits: 1, period: 'разово', features: ['1 генерация', 'Быстрая проверка оплаты', 'Все стили'], featured: false, cta: 'Купить' },
  { id: 'creator', name: 'Креатор', price: 890, credits: 14, period: '/ месяц', features: ['14 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false, cta: 'Купить' },
  { id: 'blogger', name: 'Блогер', price: 1390, credits: 24, period: '/ месяц', features: ['24 генерации (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: true, cta: 'Купить' },
  { id: 'studio', name: 'Студия УЛЬТРАВЫГОДА', price: 2550, credits: 60, period: '/ месяц', features: ['60 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false, cta: 'Купить' },
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
  const [pendingPlanId, setPendingPlanId] = useState(null)
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

  const handlePlanClick = (planId, event) => {
    event.preventDefault()
    event.stopPropagation()
    if (planId === 'start') {
      // Free plan - go to studio if authenticated, otherwise auth first
      if (isAuthenticated) {
        navigate('/studio')
      } else {
        setPendingPlanId(null)
        setAuthModalOpen(true)
      }
      return
    }
    if (isAuthenticated) {
      // Already authenticated - go to profile with pending plan
      localStorage.setItem('previewforge-pending-plan', planId)
      navigate('/profile')
    } else {
      // Not authenticated - save plan and open auth
      setPendingPlanId(planId)
      localStorage.setItem('previewforge-pending-plan', planId)
      setAuthModalOpen(true)
    }
  }

  const handleAuthSuccess = () => {
    setAuthModalOpen(false)
    const savedPlan = localStorage.getItem('previewforge-pending-plan')
    if (savedPlan) {
      localStorage.removeItem('previewforge-pending-plan')
      navigate('/profile')
    }
  }

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
            <a href="https://t.me/PreviewGen" className="tg-badge desktop-only" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
              <svg viewBox="0 0 1000 1000" width="18" height="18" fill="currentColor"><path transform="translate(-289.1496 -403.6047) scale(1.713884)" d="M226.328419,494.722069 C372.088573,431.216685 469.284839,389.350049 517.917216,369.122161 C656.772535,311.36743 685.625481,301.334815 704.431427,301.003532 C708.567621,300.93067 717.815839,301.955743 723.806446,306.816707 C728.864797,310.92121 730.256552,316.46581 730.922551,320.357329 C731.588551,324.248848 732.417879,333.113828 731.758626,340.040666 C724.234007,419.102486 691.675104,610.964674 675.110982,699.515267 C668.10208,736.984342 654.301336,749.547532 640.940618,750.777006 C611.904684,753.448938 589.856115,731.588035 561.733393,713.153237 C517.726886,684.306416 492.866009,666.349181 450.150074,638.200013 C400.78442,605.66878 432.786119,587.789048 460.919462,558.568563 C468.282091,550.921423 596.21508,434.556479 598.691227,424.000355 C599.00091,422.680135 599.288312,417.758981 596.36474,415.160431 C593.441168,412.561881 589.126229,413.450484 586.012448,414.157198 C581.598758,415.158943 511.297793,461.625274 375.109553,553.556189 C355.154858,567.258623 337.080515,573.934908 320.886524,573.585046 C303.033948,573.199351 268.692754,563.490928 243.163606,555.192408 C211.851067,545.013936 186.964484,539.632504 189.131547,522.346309 C190.260287,513.342589 202.659244,504.134509 226.328419,494.722069 Z" fill="currentColor"/></svg>
              <span>Мы в Telegram</span>
            </a>
            {isAuthenticated && (
              <button type="button" className="tg-badge tg-badge--login desktop-only" onClick={() => navigate('/studio')} aria-label="Студия">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                <span>Студия</span>
              </button>
            )}
            <button type="button" className="tg-badge tg-badge--login" onClick={() => isAuthenticated ? navigate('/profile') : setAuthModalOpen(true)} aria-label={isAuthenticated ? "Профиль" : "Войти"}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{isAuthenticated ? "Профиль" : "Войти"}</span>
            </button>
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

        <HeroMarquee />

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


        <section className="section" id="examples">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title">Примеры <span>генераций</span></h2>
              <p className="section__subtitle">Вдохновляйся готовыми стилями или загружай свой — нейросеть подстроится.</p>
            </div>
          </div>
          <ExamplesMarquee />
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
                <button
                  type="button"
                  className={`btn ${plan.featured ? 'btn--accent' : 'btn--ghost'}`}
                  onClick={(event) => handlePlanClick(plan.id, event)}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="container section" id="how">
          <div className="cta__box">
            <h2 className="cta__title">Начать генерировать</h2>
            <p className="cta__text">Загрузите фото, выберите референс и получите готовые превью за секунды.</p>
            <div className="cta__buttons">
              <TransitionLink to="/studio" className="btn btn--primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAuthModalOpen(true); return false; }}>Открыть студию</TransitionLink>
              <button type="button" className="btn btn--primary" onClick={() => isAuthenticated ? navigate('/profile') : setAuthModalOpen(true)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Профиль</span>
              </button>
              <a href="https://t.me/PreviewGen" className="btn btn--primary" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 1000 1000" width="18" height="18" fill="currentColor"><path transform="translate(-289.1496 -403.6047) scale(1.713884)" d="M226.328419,494.722069 C372.088573,431.216685 469.284839,389.350049 517.917216,369.122161 C656.772535,311.36743 685.625481,301.334815 704.431427,301.003532 C708.567621,300.93067 717.815839,301.955743 723.806446,306.816707 C728.864797,310.92121 730.256552,316.46581 730.922551,320.357329 C731.588551,324.248848 732.417879,333.113828 731.758626,340.040666 C724.234007,419.102486 691.675104,610.964674 675.110982,699.515267 C668.10208,736.984342 654.301336,749.547532 640.940618,750.777006 C611.904684,753.448938 589.856115,731.588035 561.733393,713.153237 C517.726886,684.306416 492.866009,666.349181 450.150074,638.200013 C400.78442,605.66878 432.786119,587.789048 460.919462,558.568563 C468.282091,550.921423 596.21508,434.556479 598.691227,424.000355 C599.00091,422.680135 599.288312,417.758981 596.36474,415.160431 C593.441168,412.561881 589.126229,413.450484 586.012448,414.157198 C581.598758,415.158943 511.297793,461.625274 375.109553,553.556189 C355.154858,567.258623 337.080515,573.934908 320.886524,573.585046 C303.033948,573.199351 268.692754,563.490928 243.163606,555.192408 C211.851067,545.013936 186.964484,539.632504 189.131547,522.346309 C190.260287,513.342589 202.659244,504.134509 226.328419,494.722069 Z" fill="currentColor"/></svg>
                <span>Мы в Telegram</span>
              </a>
            </div>
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

        <section className="section generated-showcase" id="generated">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title">Сгенерировано <span>нашим сервисом</span></h2>
              <p className="section__subtitle">Посмотрите примеры обложек, созданных PreviewGen.</p>
            </div>
            <div className="generated-showcase__grid">
              {generatedExamples.map((src, index) => (
                <figure className="generated-showcase__item" key={src}>
                  <img src={src} alt={`Пример работы ${index + 1}`} loading="lazy" />
                </figure>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>© {new Date().getFullYear()} PreviewGen</span>
          <div className="footer__links">
            <a href="#how">Начать генерировать</a>
            <a href="#pricing">Тарифы</a>
            <Link to="/offer">Оферта</Link>
            <Link to="/privacy">Конфиденциальность</Link>
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
          <div className="footer__legal">
            {LEGAL.fullName}, {LEGAL.taxStatus}, ИНН {LEGAL.inn}. Связь: {LEGAL.email}.
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
                const savedPlan = localStorage.getItem('previewforge-pending-plan')
                if (savedPlan) {
                  localStorage.removeItem('previewforge-pending-plan')
                  setTimeout(() => { window.location.replace('/profile') }, 150)
                } else {
                  setTimeout(() => { window.location.replace('/studio') }, 150)
                }
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
          <Route path="/offer" element={<OfferPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </TransitionProvider>
    </BrowserRouter>
  )
}

export default App
