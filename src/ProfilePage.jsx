import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getProfile, createProfile } from './lib/profile'

const purchasePlans = [
  { id: 'creator', name: 'Креатор', price: 890, credits: 14, period: '/ месяц', features: ['14 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false },
  { id: 'blogger', name: 'Блогер', price: 1390, credits: 24, period: '/ месяц', features: ['24 генерации (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: true },
  { id: 'studio', name: 'Студия УЛЬТРАВЫГОДА', price: 2550, credits: 60, period: '/ месяц', features: ['60 генераций (токенов)', 'Все стили и пресеты', 'Загрузка референсов', 'PNG + WebP экспорт'], featured: false },
]

function getLocalUser() {
  try {
    const raw = localStorage.getItem('previewforge-current-user')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [profile, setProfile] = useState(null)
  const [checking, setChecking] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [preSelectedPlan, setPreSelectedPlan] = useState(null)

  const loadProfile = async () => {
    const local = getLocalUser()
    if (!local?.email) {
      setChecking(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        let data = await getProfile(session.user.id)
        if (!data) {
          // Profile doesn't exist yet, create it
          data = await createProfile({ userId: session.user.id, email: session.user.email, fullName: session.user.email.split('@')[0] })
        }
        if (data) {
          setProfile({
            email: session.user.email,
            name: data.full_name || session.user.email.split('@')[0],
            plan: data.plan || 'Старт',
            credits: data.credits ?? 2,
            createdAt: data.created_at,
            subscriptionExpiresAt: data.subscription_expires_at,
            id: session.user.id,
          })
          setChecking(false)
          return
        }
      }
    } catch { /* ignore */ }

    setProfile({
      email: local.email,
      name: local.name || local.email.split('@')[0],
      plan: local.plan || 'Старт',
      credits: local.credits ?? 2,
      createdAt: null,
      id: local.id || null,
    })
    setChecking(false)
  }

  useEffect(() => {
    loadProfile()

    // Check for pre-selected plan from landing page
    const pendingPlan = localStorage.getItem('previewforge-pending-plan')
    if (pendingPlan) {
      setPreSelectedPlan(pendingPlan)
    }

    // Show payment status message + auto-verify payment via Success URL signature
    const outSum = searchParams.get('OutSum')
    const invId = searchParams.get('InvId')
    const signature = searchParams.get('SignatureValue')
    const payment = searchParams.get('payment')
    if (payment === 'fail') {
      setPaymentMessage('Оплата не прошла. Попробуйте ещё раз.')
    } else if (outSum && invId && signature) {
        // Robokassa appended its signature to the Success URL redirect.
        // verify-payment checks it server-side and credits the profile.
        setPaymentMessage('Проверяем оплату...')
        ;(async () => {
          try {
            const { data, error } = await supabase.functions.invoke('verify-payment', {
              body: { outSum, invId, signature },
            })
            if (error) throw error
            if (data?.ok) {
              setPaymentMessage(
                data.alreadyProcessed
                  ? 'Оплата подтверждена. Кредиты начислены.'
                  : `Оплата подтверждена! Начислено кредитов: ${data.credited}.`
              )
              if (data.profile) {
                setProfile((prev) => (prev ? {
                  ...prev,
                  plan: data.profile.plan || prev.plan,
                  credits: data.profile.credits ?? prev.credits,
                  subscriptionExpiresAt: data.profile.subscription_expires_at ?? prev.subscriptionExpiresAt,
                } : prev))
              }
            } else {
              setPaymentMessage('Оплата прошла успешно! Если кредиты не появились в течение 5 минут, сообщите об этом в поддержку.')
            }
          } catch {
            setPaymentMessage('Оплата прошла успешно! Если кредиты не появились в течение 5 минут, сообщите об этом в поддержку.')
          }
          window.history.replaceState({}, '', '/profile')
        })()
    } else if (payment === 'success') {
      setPaymentMessage('Оплата прошла успешно! Если кредиты не появились в течение 5 минут, сообщите об этом в поддержку.')
    }
  }, [searchParams])

  const handlePurchase = async (planId) => {
    setPurchasing(planId)
    setPaymentMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { planId },
      })
      if (error) {
        const context = error.context
        let message = error.message || 'Не удалось создать платёж.'
        if (context instanceof Response) {
          const body = await context.json().catch(() => null)
          message = body?.error || message
        }
        setPaymentMessage(message)
        return
      }
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        setPaymentMessage('Не удалось получить ссылку на оплату.')
      }
    } catch (err) {
      setPaymentMessage(err.message || 'Ошибка при создании платежа.')
    } finally {
      setPurchasing(null)
    }
  }

  if (checking) {
    return (
      <div className="page-shell">
        <div className="profile-page-header">
          <div className="profile-page-header__text">
            <span className="mini-label">Профиль</span>
            <h2>Загрузка...</h2>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page-shell">
        <div className="profile-page-header">
          <div className="profile-page-header__text">
            <span className="mini-label">Профиль</span>
            <h2>Доступ запрещён</h2>
          </div>
        </div>
        <section className="container section">
          <p>Войдите в аккаунт, чтобы просматривать профиль.</p>
          <button className="btn btn--primary" onClick={() => navigate('/')}>На главную</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="profile-page-header">
        <div className="profile-page-header__text">
          <span className="mini-label">Профиль</span>
          <h2>Личный кабинет</h2>
        </div>
        <button className="btn btn--primary btn--profile-back" type="button" onClick={() => navigate('/studio')}>В студию</button>
      </div>
      <section className="container section">
        <div className="profile-card profile-card--large">
          <div className="profile-card__avatar">
            <span>{profile.name.split(' ').map((n) => n[0]).join('')}</span>
          </div>
          <div className="profile-card__info">
            <h3>{profile.name}</h3>
            <p>{profile.email}</p>
          </div>
        </div>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__value">{profile.plan}</span>
            <span className="profile-stat__label">Подписка</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{profile.credits}</span>
            <span className="profile-stat__label">Кредиты</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">
              {profile.subscriptionExpiresAt
                ? (() => {
                    const days = Math.ceil(
                      (new Date(profile.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )
                    return days > 0 ? `${days} дн.` : 'истекла'
                  })()
                : '—'}
            </span>
            <span className="profile-stat__label">Подписка</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{profile.id ? profile.id.slice(0, 8) : '—'}</span>
            <span className="profile-stat__label">ID</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('ru-RU') : '—'}</span>
            <span className="profile-stat__label">Регистрация</span>
          </div>
        </div>
        <div className="profile-section">
          <h3>Управление аккаунтом</h3>
          <button className="ghost-button ghost-button--danger" type="button" onClick={async () => {
            try { await supabase.auth.signOut() } catch { /* ignore */ }
            localStorage.removeItem('previewforge-current-user')
            navigate('/')
          }}>Выйти из аккаунта</button>
        </div>
        <div className="profile-section">
          <h3>Купить кредиты</h3>
          {paymentMessage && (
            <p className="payment-message">{paymentMessage}</p>
          )}
          {preSelectedPlan && (
            <p className="payment-hint">Вы выбрали тариф — нажмите «Купить» для оплаты</p>
          )}
          <div className="pricing pricing--compact">
            {purchasePlans.map((plan) => (
              <div key={plan.id} className={`plan ${plan.featured ? 'plan--featured' : ''} ${preSelectedPlan === plan.id ? 'plan--selected' : ''}`}>
                {plan.featured && <span className="plan__badge">Хит</span>}
                <span className="plan__name">{plan.name}</span>
                <div className="plan__price">{plan.price} ₽<span>{plan.period}</span></div>
                <div className="plan__credits">{plan.credits} кредитов</div>
                <ul className="plan__features">
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <button
                  type="button"
                  className={`btn ${plan.featured ? 'btn--accent' : 'btn--ghost'}`}
                  onClick={() => handlePurchase(plan.id)}
                  disabled={purchasing === plan.id}
                >
                  {purchasing === plan.id ? 'Создание платежа...' : 'Купить'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
