import { useMemo, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import {
  albums as initialAlbums,
  generationHistory,
  profile,
  referencePreviews,
  uploadPhotos,
} from './lib/mockData'
import './App.css'

const navItems = [
  { to: '/', label: 'Главная' },
  { to: '/photos', label: 'Мои фото' },
  { to: '/generations', label: 'Мои генерации' },
  { to: '/favorites', label: 'Избранное' },
]

const defaultPrompt = `Создай 3 разных варианта YouTube-превью в формате 16:9

Референс: {{Ссылка на фото-референс}}. Старайся сделать максимально близко к оригиналу. Используй как направление по композиции, контрасту, динамике и общему вайбу.

Исходники:
{{ФОТО из Альбома}}, {{Описание альбома}}

{{ФОТО из Альбома 2}}, {{Описание альбома 2}}

Текст на превью: {{ТЕКСТ}}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.

{{ДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ}}`

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const buildNanoBananaPrompt = ({ referenceImage, selectedPhotoEntries, text, extraWishes }) => {
  const sourceEntries = selectedPhotoEntries.length
    ? selectedPhotoEntries
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.albumName}: ${entry.description}\n- ${entry.url}`,
        )
        .join('\n\n')
    : 'Не выбрано. Укажи хотя бы одно фото из альбома.'

  return `Создай 3 разных варианта YouTube-превью в формате 16:9\n\nРеференс: ${referenceImage || 'Не выбрано'}. Старайся сделать максимально близко к оригиналу. Используй как направление по композиции, контрасту, динамике и общему вайбу.\n\nИсходники:\n${sourceEntries}\n\nТекст на превью: ${text || 'Без текста'}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.\n\n${extraWishes || 'Дополнительные пожелания: сохрани баланс между текстом и изображением, не перегружай композицию, оставь сильный визуальный фокус на главном объекте.'}`
}

const buildNanoBananaRequestPayload = ({ referenceImage, selectedPhotoEntries, text, extraWishes }) => {
  const sources = selectedPhotoEntries.length
    ? selectedPhotoEntries
    : [{ url: referenceImage || uploadPhotos[0], albumName: 'Fallback', description: 'Основной источник.' }]

  const content = [
    {
      type: 'text',
      text: `Создай 3 разных варианта YouTube-превью в формате 16:9.\n\nСтарайся максимально близко повторить стиль референса по композиции, контрасту, динамике и общему вайбу.\n\nТекст на превью: ${text || 'Без текста'}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.\n\n${extraWishes || 'Дополнительные пожелания: сохрани баланс между текстом и изображением, не перегружай композицию, оставь сильный визуальный фокус на главном объекте.'}`,
    },
  ]

  if (referenceImage) {
    content.push({
      type: 'image_url',
      image_url: { url: referenceImage },
    })
  }

  sources.forEach((entry) => {
    content.push({
      type: 'image_url',
      image_url: { url: entry.url },
    })
  })

  return {
    model: 'nano-banana',
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    response_format: { type: 'image' },
    max_tokens: 1200,
  }
}

const createGeneratedPreviewSvg = ({ imageUrl, title, label }) => {
  const safeTitle = String(title || 'YouTube preview').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const safeLabel = String(label || 'Variant').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const safeImage = String(imageUrl || '').replace(/"/g, '&quot;')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0b1020"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <image href="${safeImage}" x="0" y="0" width="1280" height="720" preserveAspectRatio="cover"/>
      <rect width="1280" height="720" fill="rgba(10,14,22,0.35)"/>
      <rect x="64" y="68" width="440" height="120" rx="18" fill="rgba(10,14,22,0.42)" stroke="rgba(255,255,255,0.18)"/>
      <text x="92" y="132" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${safeTitle}</text>
      <text x="92" y="166" font-size="18" font-family="Arial, sans-serif" fill="#dfeafc">PreviewForge • ${safeLabel}</text>
      <rect x="82" y="500" width="480" height="96" rx="18" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)"/>
      <text x="118" y="564" font-size="48" font-family="Arial, sans-serif" font-weight="800" fill="#ffffff">${safeLabel}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function AuthScreen({ setAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const getLocalUsers = () => {
    try {
      return JSON.parse(localStorage.getItem('previewforge-users') || '[]')
    } catch {
      return []
    }
  }

  const setLocalUsers = (users) => {
    localStorage.setItem('previewforge-users', JSON.stringify(users))
  }

  const handleLocalAuth = ({ loginMode }) => {
    const users = getLocalUsers()

    if (loginMode === 'login') {
      const user = users.find(
        (entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.password === password,
      )

      if (!user) {
        throw new Error('Неверный email или пароль.')
      }

      localStorage.setItem('previewforge-current-user', JSON.stringify(user))
      setAuthenticated(true)
      return
    }

    if (loginMode === 'register') {
      if (users.some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Пользователь с таким email уже зарегистрирован.')
      }

      const nextUsers = [...users, { email: email.toLowerCase(), password }]
      setLocalUsers(nextUsers)
      setMessage('Локальная регистрация успешна. Теперь можно войти в аккаунт.')
      setMode('login')
      return
    }

    if (loginMode === 'reset') {
      if (code.length !== 6) {
        throw new Error('Введите 6-значный код из письма.')
      }

      const resetState = JSON.parse(localStorage.getItem('previewforge-reset') || '{}')
      if (resetState.email?.toLowerCase() !== email.toLowerCase() || resetState.code !== code) {
        throw new Error('Неверный код подтверждения.')
      }

      const user = users.find((entry) => entry.email.toLowerCase() === email.toLowerCase())
      if (!user) {
        throw new Error('Пользователь не найден.')
      }

      localStorage.removeItem('previewforge-reset')
      setMessage('Код подтверждён. Теперь можно войти в аккаунт.')
      setMode('login')
      return
    }
  }

  const handleAuth = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'login') {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          setAuthenticated(true)
          return
        } catch (error) {
          if (error?.message && /Failed to fetch|fetch/i.test(error.message)) {
            handleLocalAuth({ loginMode: 'login' })
            return
          }
          throw error
        }
      }

      if (mode === 'register') {
        try {
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          setMessage('Регистрация создана. Проверьте почту и подтвердите аккаунт.')
          return
        } catch (error) {
          if (error?.message && /Failed to fetch|fetch/i.test(error.message)) {
            handleLocalAuth({ loginMode: 'register' })
            return
          }
          throw error
        }
      }

      if (mode === 'reset') {
        try {
          if (code.length !== 6) {
            throw new Error('Введите 6-значный код из письма.')
          }
          const { error } = await supabase.auth.verifyOtp({
            email,
            token: code,
            type: 'email',
          })
          if (error) throw error
          setMessage('Код подтверждён. Теперь можно войти в аккаунт.')
          setMode('login')
          return
        } catch (error) {
          if (error?.message && /Failed to fetch|fetch/i.test(error.message)) {
            handleLocalAuth({ loginMode: 'reset' })
            return
          }
          throw error
        }
      }
    } catch (error) {
      setMessage(error.message || 'Произошла ошибка.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage('Сначала укажите email для сброса пароля.')
      return
    }

    setLoading(true)
    try {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage('Код сброса отправлен на почту. Введите 6 цифр ниже.')
        setMode('reset')
        return
      } catch (error) {
        if (error?.message && /Failed to fetch|fetch/i.test(error.message)) {
          const code = '123456'
          localStorage.setItem(
            'previewforge-reset',
            JSON.stringify({ email: email.toLowerCase(), code }),
          )
          setMessage('Код для сброса сохранён локально: 123456. Введите его ниже.')
          setMode('reset')
          return
        }
        throw error
      }
    } catch (error) {
      setMessage(error.message || 'Не удалось отправить код сброса.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-block">
          <span className="mini-label">Studio</span>
          <h1>PreviewForge</h1>
          <p>Генерация YouTube-обложек и превью за несколько минут.</p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="switcher">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Войти
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Регистрация
            </button>
          </div>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {mode !== 'reset' && (
            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          )}

          {mode === 'reset' && (
            <label>
              Код из письма
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </label>
          )}

          {message && <div className="message-box">{message}</div>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : 'Подтвердить код'}
          </button>

          {mode !== 'reset' && (
            <button
              type="button"
              className="link-button"
              onClick={handleForgotPassword}
              disabled={loading}
            >
              Забыли пароль?
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function Dashboard() {
  const [albums, setAlbums] = useState(initialAlbums)
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [editorOpen, setEditorOpen] = useState(false)
  const [albumForm, setAlbumForm] = useState({ name: '', description: '' })
  const [albumEditingId, setAlbumEditingId] = useState(null)
  const [albumDraftPhotos, setAlbumDraftPhotos] = useState([])
  const [selectedReference, setSelectedReference] = useState(null)
  const [selectedPhotoEntries, setSelectedPhotoEntries] = useState([])
  const [pickerType, setPickerType] = useState(null)
  const [generatedImages, setGeneratedImages] = useState([])
  const [previewText, setPreviewText] = useState('Как открыть свой бизнес без хаоса')
  const [extraWishes, setExtraWishes] = useState(
    'Сделай яркий, дорогой и современный стиль, без перегруза текстом, с сильным фокусом на главный объект.',
  )
  const inputRef = useRef(null)

  const favoriteGenerations = useMemo(
    () => generationHistory.filter((item) => item.favorite),
    [],
  )

  const refreshPrompt = (
    nextReference = selectedReference,
    nextSelectedPhotos = selectedPhotoEntries,
    nextText = previewText,
    nextExtra = extraWishes,
  ) => {
    const promptForRequest = buildNanoBananaPrompt({
      referenceImage: nextReference?.preview || '',
      selectedPhotoEntries: nextSelectedPhotos,
      text: nextText,
      extraWishes: nextExtra,
    })

    setPrompt(promptForRequest)
  }

  const toggleSelectedPhoto = (photoUrl, album) => {
    const entry = {
      id: `${album.id}-${photoUrl}`,
      url: photoUrl,
      albumName: album.name,
      description: album.description,
    }

    setSelectedPhotoEntries((current) => {
      const exists = current.some((item) => item.id === entry.id)
      const nextEntries = exists
        ? current.filter((item) => item.id !== entry.id)
        : [...current, entry]

      refreshPrompt(selectedReference, nextEntries, previewText, extraWishes)
      return nextEntries
    })
  }

  const openEditor = () => {
    refreshPrompt(selectedReference, selectedPhotoEntries, previewText, extraWishes)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setPickerType(null)
  }

  const handleCreateAlbum = () => {
    const name = albumForm.name.trim()
    const description = albumForm.description.trim()

    if (!name) return

    const newAlbum = {
      id: `album-${Date.now()}`,
      name,
      description: description || 'Без описания',
      count: albumDraftPhotos.length || 0,
      cover: albumDraftPhotos[0] || uploadPhotos[0],
      photos: albumDraftPhotos,
    }

    setAlbums((current) => [newAlbum, ...current])
    setAlbumForm({ name: '', description: '' })
    setAlbumDraftPhotos([])
    setAlbumEditingId(null)
  }

  const handleUpdateAlbum = () => {
    if (!albumEditingId) return

    setAlbums((current) =>
      current.map((album) =>
        album.id === albumEditingId
          ? {
              ...album,
              name: albumForm.name.trim() || album.name,
              description: albumForm.description.trim() || album.description,
              count: albumDraftPhotos.length || album.photos.length,
              cover: albumDraftPhotos[0] || album.cover,
              photos: albumDraftPhotos.length ? albumDraftPhotos : album.photos,
            }
          : album,
      ),
    )

    setAlbumForm({ name: '', description: '' })
    setAlbumDraftPhotos([])
    setAlbumEditingId(null)
  }

  const startEditAlbum = (album) => {
    setAlbumEditingId(album.id)
    setAlbumForm({ name: album.name, description: album.description })
    setAlbumDraftPhotos(album.photos || [])
  }

  const handleAddPhotos = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6)
    const dataUrls = await Promise.all(files.map((file) => toDataUrl(file)))
    setAlbumDraftPhotos((current) => [...current, ...dataUrls])
    event.target.value = ''
  }

  const handleReferenceChange = (referenceItem) => {
    setSelectedReference(referenceItem)
    setPickerType(null)
    refreshPrompt(referenceItem, selectedPhotoEntries, previewText, extraWishes)
  }

  const handleTextChange = (event) => {
    const nextText = event.target.value
    setPreviewText(nextText)
    refreshPrompt(selectedReference, selectedPhotoEntries, nextText, extraWishes)
  }

  const handleExtraWishesChange = (event) => {
    const nextExtra = event.target.value
    setExtraWishes(nextExtra)
    refreshPrompt(selectedReference, selectedPhotoEntries, previewText, nextExtra)
  }

  const handleGeneratePreview = () => {
    const sourceEntries = selectedPhotoEntries.length
      ? selectedPhotoEntries
      : [{ url: selectedReference?.preview || uploadPhotos[0], albumName: 'Исходник', description: 'Главный визуальный источник.' }]

    const requestPayload = buildNanoBananaRequestPayload({
      referenceImage: selectedReference?.preview,
      selectedPhotoEntries: sourceEntries,
      text: previewText,
      extraWishes,
    })

    console.log('Nano Banana request payload:', requestPayload)

    const nextImages = sourceEntries.slice(0, 3).map((entry, index) => ({
      id: `${entry.id || entry.url}-${index}`,
      title: previewText || `Вариант ${index + 1}`,
      label: `Вариант ${index + 1}`,
      url: createGeneratedPreviewSvg({
        imageUrl: entry.url,
        title: previewText || 'YouTube preview',
        label: `Вариант ${index + 1}`,
      }),
    }))

    setGeneratedImages(nextImages)
  }

  const downloadGeneratedImage = (imageUrl, fileName) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="logo-badge">P</div>
          <div>
            <div className="mini-label">Workspace</div>
            <strong>PreviewForge</strong>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="profile-card">
          <div className="profile-avatar">{profile.name.charAt(0)}</div>
          <div>
            <h3>{profile.name}</h3>
            <p>{profile.email}</p>
          </div>
          <div className="profile-meta">
            <span>{profile.plan}</span>
            <span>{profile.credits} credits</span>
          </div>
        </div>

        <button className="primary-button full-width" onClick={openEditor}>
          Создать новое превью
        </button>
      </aside>

      <main className="content-panel">
        <Routes>
          <Route
            path="/"
            element={
              <section>
                <div className="panel-header">
                  <div>
                    <span className="mini-label">Главная</span>
                    <h2>Плитка превью-референсов</h2>
                  </div>
                </div>

                <div className="grid-cards reference-grid">
                  {referencePreviews.map((item) => (
                    <article key={item.id} className="preview-card">
                      <img src={item.preview} alt={item.title} />
                      <div className="card-body">
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            }
          />

          <Route
            path="/photos"
            element={
              <section>
                <div className="panel-header">
                  <div>
                    <span className="mini-label">Мои фото</span>
                    <h2>Загруженные исходники</h2>
                  </div>
                </div>

                <div className="album-form-wrap">
                  <div className="album-form">
                    <h3>{albumEditingId ? 'Редактировать альбом' : 'Создать альбом'}</h3>
                    <input
                      type="text"
                      placeholder="Название альбома"
                      value={albumForm.name}
                      onChange={(event) => setAlbumForm((current) => ({ ...current, name: event.target.value }))}
                    />
                    <textarea
                      placeholder="Описание альбома"
                      rows={4}
                      value={albumForm.description}
                      onChange={(event) =>
                        setAlbumForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />

                    <div className="upload-row">
                      <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleAddPhotos}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => inputRef.current?.click()}
                      >
                        Добавить фото
                      </button>
                    </div>

                    <div className="album-preview-photos">
                      {albumDraftPhotos.length === 0 ? (
                        <p>Фотографии ещё не добавлены.</p>
                      ) : (
                        albumDraftPhotos.map((image, index) => (
                          <img key={`${image}-${index}`} src={image} alt={`Draft ${index + 1}`} />
                        ))
                      )}
                    </div>

                    <div className="album-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={albumEditingId ? handleUpdateAlbum : handleCreateAlbum}
                      >
                        {albumEditingId ? 'Сохранить изменения' : 'Создать альбом'}
                      </button>
                      {albumEditingId && (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setAlbumEditingId(null)
                            setAlbumForm({ name: '', description: '' })
                            setAlbumDraftPhotos([])
                          }}
                        >
                          Отмена
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="album-list">
                  {albums.map((album) => (
                    <div key={album.id} className="album-card">
                      <img src={album.cover} alt={album.name} />
                      <div>
                        <h3>{album.name}</h3>
                        <p>{album.description}</p>
                        <div className="album-meta-row">
                          <span>{album.count} фото</span>
                          <button type="button" onClick={() => startEditAlbum(album)}>
                            Редактировать
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="photo-strip">
                  {uploadPhotos.map((image, index) => (
                    <div key={`${image}-${index}`} className="photo-item">
                      <img src={image} alt={`Фото ${index + 1}`} />
                    </div>
                  ))}
                </div>
              </section>
            }
          />

          <Route
            path="/generations"
            element={
              <section>
                <div className="panel-header">
                  <div>
                    <span className="mini-label">Мои генерации</span>
                    <h2>Созданные превью</h2>
                  </div>
                </div>

                <div className="grid-cards generation-grid">
                  {generationHistory.map((item) => (
                    <article key={item.id} className="generation-card">
                      <img src={item.image} alt={item.title} />
                      <div className="card-body">
                        <h3>{item.title}</h3>
                        <p>{item.createdAt}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            }
          />

          <Route
            path="/favorites"
            element={
              <section>
                <div className="panel-header">
                  <div>
                    <span className="mini-label">Избранное</span>
                    <h2>Любимые превью</h2>
                  </div>
                </div>

                <div className="grid-cards generation-grid">
                  {favoriteGenerations.map((item) => (
                    <article key={item.id} className="generation-card">
                      <img src={item.image} alt={item.title} />
                      <div className="card-body">
                        <h3>{item.title}</h3>
                        <p>{item.createdAt}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            }
          />
        </Routes>
      </main>

      {editorOpen && (
        <div className="editor-overlay" onClick={closeEditor}>
          <div className="editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="editor-header">
              <div>
                <span className="mini-label">Новый проект</span>
                <h2>Редактор превью</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeEditor}>
                Закрыть
              </button>
            </div>

            <div className="editor-grid">
              <div className="editor-column left-panel">
                <div className="field-block">
                  <label>Название видео</label>
                  <input
                    type="text"
                    placeholder="Например: Как запустить бизнес без стресса"
                    value={previewText}
                    onChange={handleTextChange}
                  />
                </div>

                <div className="field-block">
                  <label>Выбор референса</label>
                  <button type="button" className="picker-button" onClick={() => setPickerType('reference')}>
                    {selectedReference ? (
                      <span className="picker-selected-wrap">
                        <span className="mini-thumb-wrap">
                          <img src={selectedReference.preview} alt={selectedReference.title} />
                        </span>
                        <span>{selectedReference.title}</span>
                      </span>
                    ) : (
                      'Не выбрано'
                    )}
                  </button>
                </div>

                <div className="field-block">
                  <label>Выбор фото</label>
                  <button type="button" className="picker-button" onClick={() => setPickerType('source')}>
                    {selectedPhotoEntries.length > 0
                      ? `${selectedPhotoEntries.length} фото выбрано`
                      : 'Не выбрано'}
                  </button>

                  {selectedPhotoEntries.length > 0 && (
                    <div className="selected-photo-strip">
                      {selectedPhotoEntries.map((entry) => (
                        <div key={entry.id} className="selected-photo-item">
                          <img src={entry.url} alt={entry.albumName} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field-block">
                  <label>Дополнительные пожелания</label>
                  <textarea
                    value={extraWishes}
                    onChange={handleExtraWishesChange}
                    rows={4}
                    placeholder="Например: Делай яркий, дорогой и современный стиль..."
                  />
                </div>

                <div className="field-block">
                  <label>Стиль оформления</label>
                  <div className="chip-list">
                    <span>cinematic</span>
                    <span>minimal</span>
                    <span>bold</span>
                    <span>tech</span>
                    <span>dark</span>
                  </div>
                </div>

                <button type="button" className="primary-button full-width" onClick={handleGeneratePreview}>
                  Создать превью
                </button>
              </div>

              <div className="editor-column right-panel">
                {generatedImages.length > 0 ? (
                  <div className="result-grid">
                    {generatedImages.map((image) => (
                      <div key={image.id} className="result-card">
                        <img src={image.url} alt={image.title} />
                        <div className="result-card-actions">
                          <span>{image.label}</span>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => downloadGeneratedImage(image.url, `${image.label}.png`)}
                          >
                            Скачать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-result">
                    <h3>Результаты генерации</h3>
                    <p>Нажмите “Создать превью”, чтобы сгенерировать 3 варианта изображения.</p>
                  </div>
                )}
              </div>
            </div>

            {pickerType && (
              <div className="picker-overlay" onClick={() => setPickerType(null)}>
                <div className="picker-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="picker-header">
                    <h3>
                      {pickerType === 'reference' ? 'Выбрать референс' : 'Выбрать фото из альбома'}
                    </h3>
                    <button className="ghost-button" type="button" onClick={() => setPickerType(null)}>
                      Закрыть
                    </button>
                  </div>

                  {pickerType === 'reference' ? (
                    <div className="picker-grid">
                      {referencePreviews.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="picker-option-card"
                          onClick={() => handleReferenceChange(item)}
                        >
                          <img src={item.preview} alt={item.title} />
                          <span>{item.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="album-picker-list">
                      {albums.map((album) => (
                        <div key={album.id} className="album-picker-card">
                          <div className="picker-card-header">
                            <div>
                              <strong>{album.name}</strong>
                              <p>{album.description}</p>
                            </div>
                          </div>

                          <div className="picker-photo-grid">
                            {album.photos.map((photo, index) => {
                              const isSelected = selectedPhotoEntries.some(
                                (entry) => entry.id === `${album.id}-${photo}`,
                              )

                              return (
                                <button
                                  key={`${album.id}-${photo}-${index}`}
                                  type="button"
                                  className={`picker-photo-card ${isSelected ? 'selected' : ''}`}
                                  onClick={() => toggleSelectedPhoto(photo, album)}
                                >
                                  <img src={photo} alt={`${album.name} ${index + 1}`} />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)

  return (
    <BrowserRouter>
      {!authenticated ? (
        <AuthScreen setAuthenticated={setAuthenticated} />
      ) : (
        <Dashboard />
      )}
    </BrowserRouter>
  )
}

export default App
