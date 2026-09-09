import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getProfile } from './lib/profile'

function getLocalUser() {
  try {
    const raw = localStorage.getItem('previewforge-current-user')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const local = getLocalUser()
      if (!local?.email) {
        if (!cancelled) setChecking(false)
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && !cancelled) {
          const data = await getProfile(session.user.id)
          if (data) {
            setProfile({
              email: session.user.email,
              name: data.full_name || session.user.email.split('@')[0],
              plan: data.plan || 'Старт',
              credits: data.credits ?? 0,
              createdAt: data.created_at,
              id: session.user.id,
            })
            setChecking(false)
            return
          }
        }
      } catch { /* ignore */ }

      if (!cancelled) {
        setProfile({
          email: local.email,
          name: local.name || local.email.split('@')[0],
          plan: local.plan || 'Старт',
          credits: local.credits ?? 0,
          createdAt: null,
          id: local.id || null,
        })
        setChecking(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [navigate])

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
            <span className="profile-stat__value">{profile.id ? profile.id.slice(0, 8) : '—'}</span>
            <span className="profile-stat__label">ID</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__value">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('ru-RU') : '—'}</span>
            <span className="profile-stat__label">Регистрация</span>
          </div>
        </div>
        <div className="profile-section">
          <h3>Безопасность</h3>
          <button className="ghost-button" type="button" onClick={async () => { await supabase.auth.signOut(); navigate('/') }}>Выйти из аккаунта</button>
        </div>
      </section>
    </div>
  )
}
