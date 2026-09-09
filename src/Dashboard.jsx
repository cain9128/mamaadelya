import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import {
  albums as initialAlbums,
  generationHistory,
  profile,
  referencePreviews,
  presetsList,
  uploadPhotos,
} from './lib/mockData'

const defaultPrompt = `Создай YouTube-превью в формате 16:9

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

const urlToDataUrl = async (url) => {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

const formatMeta = {
  '16x9': { label: 'YouTube 16:9', aspectRatio: '16:9' },
}

const buildNanoBananaPrompt = ({ referenceImage, selectedPhotoEntries, text, extraWishes, refSlots, previewFormat }) => {
  const sourceEntries = selectedPhotoEntries.length
    ? selectedPhotoEntries
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.albumName}: ${entry.description}\n- ${entry.url}`,
        )
        .join('\n\n')
    : 'Не выбрано. Укажи хотя бы одно фото из альбома.'

  const formatInfo = formatMeta[previewFormat] || formatMeta['16x9']
  const refEntries = (refSlots || [])
    .filter((slot) => slot.filled && slot.src)
    .map((slot, index) => `${index + 1}. Референсное фото: ${slot.src}`)
    .join('\n')

  return `Создай YouTube-превью в формате ${formatInfo.label}\n\nРеференсный стиль: ${referenceImage || 'Не выбрано'}. Старайся сделать максимально близко к оригиналу. Используй как направление по композиции, контрасту, динамике и общему вайбу.\n${refEntries ? `Референсные изображения:\n${refEntries}\n` : ''}\nИсходники:\n${sourceEntries}\n\nТекст на превью: ${text || 'Без текста'}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.\n\n${extraWishes || 'Дополнительные пожелания: сохрани баланс между текстом и изображением, не перегружай композицию, оставь сильный визуальный фокус на главном объекте.'}`
}

const buildNanoBananaRequestPayload = ({ referenceImage, selectedPhotoEntries, text, extraWishes, refSlots, previewFormat }) => {
  const sources = selectedPhotoEntries.length
    ? selectedPhotoEntries
    : [{ url: referenceImage || uploadPhotos[0], albumName: 'Fallback', description: 'Основной источник.' }]

  const formatInfo = formatMeta[previewFormat] || formatMeta['16x9']

  const content = [
    {
      type: 'text',
      text: `Создай YouTube-превью в формате ${formatInfo.label}.\n\nСтарайся максимально близко повторить стиль референса по композиции, контрасту, динамике и общему вайбу.\n\nТекст на превью: ${text || 'Без текста'}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.\n\n${extraWishes || 'Дополнительные пожелания: сохрани баланс между текстом и изображением, не перегружай композицию, оставь сильный визуальный фокус на главном объекте.'}`,
    },
  ]

  if (referenceImage) {
    content.push({ type: 'image_url', image_url: { url: referenceImage } })
  }

  (refSlots || [])
    .filter((slot) => slot.filled && slot.src)
    .forEach((slot) => {
      content.push({ type: 'image_url', image_url: { url: slot.src } })
    })

  sources.forEach((entry) => {
    content.push({ type: 'image_url', image_url: { url: entry.url } })
  })

  return {
    model: 'google/gemini-3-pro-image-preview',
    messages: [{ role: 'user', content }],
    response_format: { type: 'image' },
    max_tokens: 1200,
    aspect_ratio: formatInfo.aspectRatio,
  }
}

const dogAvatarSvgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#ffffff"/>
    <g transform="translate(18 18)">
      <ellipse cx="82" cy="122" rx="58" ry="42" fill="#2d2a2e"/>
      <path d="M38 109 L18 90 L28 74 L56 72 L62 56 L80 40 L96 56 L105 72 L127 72 L143 90 L124 109 Z" fill="#3d3739"/>
      <path d="M62 48 L72 26 L90 38 L92 58 Z" fill="#1d1d1d"/>
      <circle cx="72" cy="68" r="8" fill="#f3d7b5"/>
      <circle cx="98" cy="68" r="8" fill="#f3d7b5"/>
      <path d="M74 80 Q84 90 94 80" stroke="#f3d7b5" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="84" cy="103" rx="18" ry="12" fill="#f3d7b5"/>
      <path d="M46 110 Q56 82 66 90 Q58 126 40 130 Z" fill="#2d2a2e"/>
      <path d="M118 110 Q108 82 98 90 Q106 126 124 130 Z" fill="#2d2a2e"/>
      <path d="M58 137 Q74 124 90 140 Q106 124 122 137 L118 162 Q94 174 70 162 Z" fill="#4a3a39"/>
      <path d="M60 96 Q84 110 108 96" stroke="#f8eee7" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M80 110 L82 136" stroke="#f8eee7" stroke-width="4" stroke-linecap="round"/>
      <path d="M52 118 L30 130" stroke="#4a3a39" stroke-width="8" stroke-linecap="round"/>
      <path d="M112 118 L136 130" stroke="#4a3a39" stroke-width="8" stroke-linecap="round"/>
      <path d="M48 148 L36 168" stroke="#4a3a39" stroke-width="9" stroke-linecap="round"/>
      <path d="M116 148 L128 168" stroke="#4a3a39" stroke-width="9" stroke-linecap="round"/>
      <path d="M70 145 L62 174" stroke="#4a3a39" stroke-width="8" stroke-linecap="round"/>
      <path d="M98 145 L106 174" stroke="#4a3a39" stroke-width="8" stroke-linecap="round"/>
    </g>
  </svg>
`)}`

const navItems = [
  { to: '/studio', label: 'Главная' },
  { to: '/studio/photos', label: 'Мои фото' },
  { to: '/studio/generations', label: 'Мои генерации' },
  { to: '/studio/favorites', label: 'Избранное' },
  { to: '/studio/presets', label: 'Прессеты' },
  { to: '/studio/profile', label: 'Профиль' },
]
export function AuthScreen({ onAuthenticated, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const getLocalUsers = () => {
    try { return JSON.parse(localStorage.getItem('previewforge-users') || '[]') } catch { return [] }
  }
  const setLocalUsers = (users) => localStorage.setItem('previewforge-users', JSON.stringify(users))

  const localAuth = ({ loginMode }) => {
    const users = getLocalUsers()
    const emailKey = email.trim().toLowerCase()
    if (loginMode === 'login') {
      const user = users.find((u) => u.email.toLowerCase() === emailKey && u.password === password)
      if (!user) throw new Error('Неверный email или пароль.')
      localStorage.setItem('previewforge-current-user', JSON.stringify(user))
      setMessage('Вход выполнен.')
      onAuthenticated?.()
      return
    }
    if (loginMode === 'register') {
      if (users.some((u) => u.email.toLowerCase() === emailKey)) {
        throw new Error('Пользователь с таким email уже зарегистрирован.')
      }
      const newUser = { email: emailKey, password, name: emailKey.split('@')[0], credits: 2, plan: 'Старт' }
      setLocalUsers([...users, newUser])
      localStorage.setItem('previewforge-current-user', JSON.stringify(newUser))
      setMessage('Регистрация успешна.')
      onAuthenticated?.()
      return
    }
    if (loginMode === 'reset') {
      if (code.length !== 6) throw new Error('Введите 6-значный код из письма.')
      const resetState = JSON.parse(localStorage.getItem('previewforge-reset') || '{}')
      if (resetState.email?.toLowerCase() !== emailKey || resetState.code !== code) {
        throw new Error('Неверный код подтверждения.')
      }
      const user = users.find((u) => u.email.toLowerCase() === emailKey)
      if (!user) throw new Error('Пользователь не найден.')
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
          setMessage('Вход выполнен.')
          onAuthenticated?.()
          return
        } catch (error) {
          console.error('Supabase login error, fallback to local:', error)
          localAuth({ loginMode: 'login' })
          return
        }
      }
      if (mode === 'register') {
        try {
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          setMessage('Регистрация создана. Проверьте почту и подтвердите аккаунт.')
          return
        } catch (error) {
          console.error('Supabase signup error, fallback to local:', error)
          localAuth({ loginMode: 'register' })
          return
        }
      }
      if (mode === 'reset') {
        try {
          if (code.length !== 6) throw new Error('Введите 6-значный код из письма.')
          const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
          if (error) throw error
          setMessage('Код подтверждён. Теперь можно войти в аккаунт.')
          setMode('login')
          return
        } catch (error) {
          console.error('Supabase verifyOtp error, fallback to local:', error)
          localAuth({ loginMode: 'reset' })
          return
        }
      }
    } catch (error) {
      setMessage(error.message || 'Произошла ошибка.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setMessage('Сначала укажите email для сброса пароля.'); return }
    setLoading(true)
    try {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage('Код сброса отправлен на почту. Введите 6 цифр ниже.')
        setMode('reset')
        return
      } catch (error) {
        console.error('Supabase resetPassword error, fallback to local:', error)
        localStorage.setItem('previewforge-reset', JSON.stringify({ email: email.trim().toLowerCase(), code: '123456' }))
        setMessage('Код для сброса сохранён локально: 123456. Введите его ниже.')
        setMode('reset')
        return
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
          <h1>PreviewGen</h1>
          <p>Генерация YouTube-обложек и превью за несколько минут.</p>
        </div>
        <form onSubmit={handleAuth} className="auth-form">
          <div className="switcher">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Войти</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Регистрация</button>
          </div>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          {mode !== 'reset' && (
            <label>
              Пароль
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
            </label>
          )}
          {mode === 'reset' && (
            <label>
              Код из письма
              <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" />
            </label>
          )}
          {onClose && <button className="ghost-button auth-close" type="button" onClick={onClose}>Закрыть</button>}
          {message && <div className="message-box">{message}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : 'Подтвердить код'}
          </button>
          {mode !== 'reset' && (
            <button type="button" className="link-button" onClick={handleForgotPassword} disabled={loading}>Забыли пароль?</button>
          )}
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [albums, setAlbums] = useState(initialAlbums)
  const [, setPrompt] = useState(defaultPrompt)
  const [editorOpen, setEditorOpen] = useState(false)
  const [albumForm, setAlbumForm] = useState({ name: '', description: '' })
  const [albumEditingId, setAlbumEditingId] = useState(null)
  const [albumDraftPhotos, setAlbumDraftPhotos] = useState([])
  const [selectedReference, setSelectedReference] = useState(null)
  const [selectedPhotoEntries, setSelectedPhotoEntries] = useState([])
  const [pickerType, setPickerType] = useState(null)
  const [generatedImages, setGeneratedImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewFormat, setPreviewFormat] = useState('16x9')
  const [extraWishes, setExtraWishes] = useState('')
  const [editingImage, setEditingImage] = useState(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [refSlots, setRefSlots] = useState([
    { filled: false, locked: false, src: null },
  ])
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return !!localStorage.getItem('previewforge-current-user') } catch { return false }
  })
  const [currentUser, setCurrentUser] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pendingGeneration, setPendingGeneration] = useState(false)
  const displayProfile = currentUser || profile

  const inputRef = useRef(null)
  const customReferenceInputRef = useRef(null)
  const ownPhotoInputRef = useRef(null)
  const ownPhotoIdRef = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session?.user) {
          setIsAuthenticated(true)
          setCurrentUser({ email: session.user.email, id: session.user.id })
          return
        }
      } catch {
        // Supabase недоступен — проверим локальный storage
      }
      try {
        const raw = localStorage.getItem('previewforge-current-user')
        if (raw) {
          const user = JSON.parse(raw)
          if (user?.email) {
            setIsAuthenticated(true)
            setCurrentUser(user)
          }
        }
      } catch {
        // ignore
      }
    }
    checkSession()

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          setIsAuthenticated(true)
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
          setCurrentUser(null)
        }
      })
      return () => { cancelled = true; subscription.unsubscribe() }
    } catch {
      return () => { cancelled = true }
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

  const handleCustomReferenceUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await toDataUrl(file)
      setRefSlots((current) => {
        const idx = current.findIndex((s) => !s.locked && !s.filled)
        if (idx === -1) return current
        const next = [...current]
        next[idx] = { ...next[idx], filled: true, src: dataUrl }
        return next
      })
      setPickerType(null)
    } catch (error) { console.error('Failed to read custom reference', error) }
    event.target.value = ''
  }

  const handleOwnPhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await toDataUrl(file)
      const id = `custom-${++ownPhotoIdRef.current}`
      const entry = { id, url: dataUrl, albumName: 'Своё фото', description: file.name }
      setSelectedPhotoEntries((current) => {
        if (current.length >= 4) return current
        const nextEntries = [...current, entry]
        refreshPrompt(selectedReference, nextEntries, previewText, extraWishes, refSlots, previewFormat)
        return nextEntries
      })
    } catch (error) { console.error('Failed to read own photo', error) }
    event.target.value = ''
  }

  const removeSelectedPhoto = (id) => {
    setSelectedPhotoEntries((current) => {
      const nextEntries = current.filter((item) => item.id !== id)
        refreshPrompt(selectedReference, nextEntries, previewText, extraWishes, refSlots, previewFormat)
      return nextEntries
    })
  }

  const favoriteGenerations = useMemo(() => generationHistory.filter((item) => item.favorite), [])

  const refreshPrompt = (
    nextReference = selectedReference,
    nextSelectedPhotos = selectedPhotoEntries,
    nextText = previewText,
    nextExtra = extraWishes,
    nextRefSlots = refSlots,
    nextPreviewFormat = previewFormat,
  ) => {
    const promptForRequest = buildNanoBananaPrompt({
      referenceImage: nextReference?.preview || '',
      selectedPhotoEntries: nextSelectedPhotos,
      text: nextText,
      extraWishes: nextExtra,
      refSlots: nextRefSlots,
      previewFormat: nextPreviewFormat,
    })
    setPrompt(promptForRequest)
  }

  const toggleSelectedPhoto = (photoUrl, album) => {
    const entry = { id: `${album.id}-${photoUrl}`, url: photoUrl, albumName: album.name, description: album.description }
    setSelectedPhotoEntries((current) => {
      const exists = current.some((item) => item.id === entry.id)
      const nextEntries = exists ? current.filter((item) => item.id !== entry.id) : [...current, entry]
        refreshPrompt(selectedReference, nextEntries, previewText, extraWishes, refSlots, previewFormat)
      return nextEntries
    })
  }

  const openEditor = () => {
    refreshPrompt(selectedReference, selectedPhotoEntries, previewText, extraWishes, refSlots, previewFormat)
    setEditorOpen(true)
  }
  const closeEditor = () => { setEditorOpen(false); setPickerType(null); navigate('/') }

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
    refreshPrompt(referenceItem, selectedPhotoEntries, previewText, extraWishes, refSlots, previewFormat)
  }

  const handlePresetSelect = async (presetItem) => {
    try {
      const dataUrl = await urlToDataUrl(presetItem.preview)
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        console.error('Invalid data URL from preset:', presetItem.preview)
        return
      }
      setRefSlots((current) => {
        const idx = current.findIndex((s) => !s.locked && !s.filled)
        if (idx === -1) return current
        const next = [...current]
        next[idx] = { ...next[idx], filled: true, src: dataUrl }
        return next
      })
      setSelectedReference({ id: presetItem.id, title: presetItem.title, preview: dataUrl })
      setPresetsOpen(false)
      refreshPrompt({ id: presetItem.id, title: presetItem.title, preview: dataUrl }, selectedPhotoEntries, previewText, extraWishes, refSlots, previewFormat)
      navigate('/studio')
    } catch (error) {
      console.error('Failed to load preset image:', presetItem.preview, error)
    }
  }
  const handleTextChange = (event) => {
    const nextText = event.target.value
    setPreviewText(nextText)
    refreshPrompt(selectedReference, selectedPhotoEntries, nextText, extraWishes, refSlots, previewFormat)
  }
  const handleExtraWishesChange = (event) => {
    const nextExtra = event.target.value
    setExtraWishes(nextExtra)
    refreshPrompt(selectedReference, selectedPhotoEntries, previewText, nextExtra, refSlots, previewFormat)
  }

  const handleGeneratePreview = async () => {
    if (!isAuthenticated) {
      setPendingGeneration(true)
      setAuthModalOpen(true)
      return
    }
    const sourceEntries = selectedPhotoEntries.length
      ? selectedPhotoEntries
      : [{ url: selectedReference?.preview || uploadPhotos[0], albumName: 'Исходник', description: 'Главный визуальный источник.' }]
    const requestPayload = buildNanoBananaRequestPayload({
      referenceImage: selectedReference?.preview,
      selectedPhotoEntries: sourceEntries,
      text: previewText,
      extraWishes,
      refSlots,
      previewFormat,
    })
    setIsGenerating(true)
    setGenerationError('')
    try {
      const { data, error } = await supabase.functions.invoke('generate-preview', { body: { requestPayload, variants: 1 } })
      if (error) throw error
      if (!data?.images?.length) throw new Error('OpenRouter не вернул изображения.')
      setGeneratedImages(data.images.map((url, index) => ({
        id: `${Date.now()}-${index}`,
        title: previewText || `Вариант ${index + 1}`,
        label: `Вариант ${index + 1}`,
        url,
      })))
    } catch (error) {
      let message = error.message || 'Не удалось создать превью.'
      if (error.context instanceof Response) {
        const responseBody = await error.context.json().catch(() => null)
        message = responseBody?.error || message
      }
      setGenerationError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditImage = async (image) => {
    if (!editPrompt.trim()) return

    const formatInfo = formatMeta['16x9']
    const requestPayload = {
      messages: [{
        content: [
          { type: 'text', text: `Внеси изменения в изображение: ${editPrompt}\nСохрани общий стиль и композицию, но учти указанные правки.\nФормат: ${formatInfo.label}` },
          { type: 'image_url', image_url: { url: image.url } },
        ]
      }],
      aspect_ratio: '16:9',
    }

    setIsGenerating(true)
    setGenerationError('')
    try {
      const { data, error } = await supabase.functions.invoke('generate-preview', {
        body: { requestPayload, variants: 1 }
      })
      if (error) throw error
      if (!data?.images?.length) throw new Error('OpenRouter не вернул изображения.')
      setGeneratedImages(data.images.map((url, index) => ({
        id: `${Date.now()}-${index}`,
        title: editPrompt || `Вариант ${index + 1}`,
        label: `Вариант ${index + 1}`,
        url,
      })))
      setEditingImage(null)
      setEditPrompt('')
    } catch (error) {
      let message = error.message || 'Не удалось отредактировать превью.'
      if (error.context instanceof Response) {
        const responseBody = await error.context.json().catch(() => null)
        message = responseBody?.error || message
      }
      setGenerationError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadGeneratedImage = (imageUrl, fileName) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (editorOpen || pickerType) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [editorOpen, pickerType])

  useEffect(() => {
    if (pendingGeneration && isAuthenticated && !authModalOpen) {
      setPendingGeneration(false)
      handleGeneratePreview()
    }
  }, [pendingGeneration, isAuthenticated, authModalOpen])

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="logo-badge">S</div>
          <div>
            <div className="mini-label">Community</div>
            <strong>PrewievGen</strong>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/studio'} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="profile-card">
          <div className="profile-avatar"><img src={dogAvatarSvgDataUrl} alt={displayProfile.name} /></div>
          <div>
            <h3>{displayProfile.name}</h3>
            <p>{displayProfile.email}</p>
          </div>
          <div className="profile-meta">
            <span>{displayProfile.plan}</span>
            <span>{displayProfile.credits} credits</span>
          </div>
        </div>
        <button className="primary-button full-width" onClick={openEditor}>Создать новое превью</button>
        {isAuthenticated && (
          <button className="ghost-button full-width" onClick={handleSignOut} style={{ marginTop: 8 }}>Выйти из аккаунта</button>
        )}
      </aside>

      <main className="content-panel">
        <div className="content-top-bar">
          <button
            type="button"
            className="back-home-btn"
            onClick={() => navigate('/')}
            aria-label="На главный экран"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>На главный экран</span>
          </button>
          <NavLink to="/studio/profile" className="profile-top-btn" aria-label="Профиль">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </NavLink>
        </div>
        <Routes>
          <Route path="/" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Главная</span><h2>Плитка превью-референсов</h2></div></div>
              <div className="grid-cards reference-grid">
                {referencePreviews.map((item) => (
                  <article key={item.id} className="preview-card">
                    <img src={item.preview} alt={item.title} />
                    <div className="card-body"><h3>{item.title}</h3><p>{item.description}</p></div>
                  </article>
                ))}
              </div>
            </section>
          } />
          <Route path="/photos" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Мои фото</span><h2>Загруженные исходники</h2></div></div>
              <div className="album-form-wrap">
                <div className="album-form">
                  <h3>{albumEditingId ? 'Редактировать альбом' : 'Создать альбом'}</h3>
                  <input type="text" placeholder="Название альбома" value={albumForm.name} onChange={(event) => setAlbumForm((current) => ({ ...current, name: event.target.value }))} />
                  <textarea placeholder="Описание альбома" rows={4} value={albumForm.description} onChange={(event) => setAlbumForm((current) => ({ ...current, description: event.target.value }))} />
                  <div className="upload-row">
                    <input ref={inputRef} type="file" multiple accept="image/*" onChange={handleAddPhotos} />
                    <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>Добавить фото</button>
                  </div>
                  <div className="album-preview-photos">
                    {albumDraftPhotos.length === 0 ? <p>Фотографии ещё не добавлены.</p> : albumDraftPhotos.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`Draft ${index + 1}`} />)}
                  </div>
                  <div className="album-actions">
                    <button className="primary-button" type="button" onClick={albumEditingId ? handleUpdateAlbum : handleCreateAlbum}>
                      {albumEditingId ? 'Сохранить изменения' : 'Создать альбом'}
                    </button>
                    {albumEditingId && (
                      <button className="ghost-button" type="button" onClick={() => { setAlbumEditingId(null); setAlbumForm({ name: '', description: '' }); setAlbumDraftPhotos([]) }}>Отмена</button>
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
                        <button type="button" onClick={() => startEditAlbum(album)}>Редактировать</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="photo-strip">
                {uploadPhotos.map((image, index) => (
                  <div key={`${image}-${index}`} className="photo-item"><img src={image} alt={`Фото ${index + 1}`} /></div>
                ))}
              </div>
            </section>
          } />
          <Route path="/generations" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Мои генерации</span><h2>Созданные превью</h2></div></div>
              <div className="grid-cards generation-grid">
                {generationHistory.map((item) => (
                  <article key={item.id} className="generation-card">
                    <img src={item.image} alt={item.title} />
                    <div className="card-body"><h3>{item.title}</h3><p>{item.createdAt}</p></div>
                  </article>
                ))}
              </div>
            </section>
          } />
          <Route path="/favorites" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Избранное</span><h2>Любимые превью</h2></div></div>
              <div className="grid-cards generation-grid">
                {favoriteGenerations.map((item) => (
                  <article key={item.id} className="generation-card">
                    <img src={item.image} alt={item.title} />
                    <div className="card-body"><h3>{item.title}</h3><p>{item.createdAt}</p></div>
                  </article>
                ))}
              </div>
            </section>
          } />
          <Route path="/presets" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Прессеты</span><h2>Шаблоны обложек</h2></div></div>
              <div className="picker-grid">
                {referencePreviews.filter((item) => item.isPreset).map((item) => (
                  <button key={item.id} type="button" className="picker-option-card" onClick={() => { handleReferenceChange(item); navigate('/studio') }}>
                    <img src={item.preview} alt={item.title} /><span>{item.title}</span>
                  </button>
                ))}
              </div>
            </section>
          } />
          <Route path="/profile" element={
            <section>
              <div className="panel-header"><div><span className="mini-label">Профиль</span><h2>Аккаунт</h2></div></div>
              <div className="profile-block">
                <div className="profile-card">
                  <div className="profile-card__avatar">
                    <span>{displayProfile.name.split(' ').map((n) => n[0]).join('')}</span>
                  </div>
                  <div className="profile-card__info">
                    <h3>{displayProfile.name}</h3>
                    <p>{displayProfile.email}</p>
                  </div>
                </div>
                <div className="profile-stats">
                  <div className="profile-stat">
                    <span className="profile-stat__value">{displayProfile.credits}</span>
                    <span className="profile-stat__label">Токенов</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat__value">{displayProfile.plan}</span>
                    <span className="profile-stat__label">Тариф</span>
                  </div>
                </div>
                {isAuthenticated && (
                  <div className="profile-section">
                    <button className="ghost-button" type="button" onClick={handleSignOut}>Выйти из аккаунта</button>
                  </div>
                )}
                <div className="profile-section">
                  <h3>История операций</h3>
                  <div className="profile-empty">
                    <p>Платёжная система не подключена. История появится после интеграции.</p>
                  </div>
                </div>
              </div>
            </section>
          } />
        </Routes>
      </main>

      <div className="editor-overlay" style={{ display: editorOpen ? 'flex' : 'none' }}>
          <div className="editor-modal editor-modal--studio" onClick={(e) => e.stopPropagation()}>
            <div className="editor-header editor-header--studio">
              <h2>Создать превью</h2>
              <button className="editor-close" type="button" onClick={closeEditor} aria-label="Закрыть">×</button>
            </div>

            <div className="editor-grid editor-grid--studio">
              <div className="editor-column left-panel left-panel--studio">
                <div className="field-block">
                  <div className="field-label-row">
                    <label>Промпт для обложки</label>
                    <span className="char-counter">{previewText.length} / 512</span>
                  </div>
                  <div className="prompt-textarea-wrapper">
                    <textarea
                      className="prompt-textarea"
                      value={previewText}
                      onChange={handleTextChange}
                      maxLength={512}
                      rows={4}
                    />
                    {!previewText && (
                      <div className="prompt-hint">
                        Напишите то, что вы хотите видеть на своей обложке. Советуем всегда добавлять референс
                      </div>
                    )}
                  </div>
                </div>

                <div className="studio-tip">
                  <span className="studio-tip__icon">💡</span>
                  <div className="studio-tip__text">
                    Советую всегда использовать референс для четкой генерации. После того как вы сгенерировали вы можете внести свои правки нажав кнопку "Редактировать" В промпте пишите все детали конкретно.
                  </div>
                </div>

                <button type="button" className="presets-banner" onClick={() => setPresetsOpen(true)}>
                  <span className="presets-banner__label">🎨 Выбрать прессет</span>
                  <span className="presets-banner__hint">Нажмите, чтобы открыть библиотеку шаблонов</span>
                </button>

                <div className="field-block">
                  <label>Формат превью</label>
                  <div className="format-cards">
                    {[
                      { id: '16x9', title: 'YouTube', sub: 'YouTube, обложки блогов', size: '1280x720' },
                    ].map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`format-card-option ${previewFormat === card.id ? 'is-selected' : ''}`}
                        onClick={() => setPreviewFormat(card.id)}
                      >
                        <span className="format-card-option__title">{card.id} · {card.title}</span>
                        <span className="format-card-option__sub">{card.sub}</span>
                        <span className="format-card-option__size">{card.size}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-block">
                  <div className="field-label-row">
                    <label>Референсные фото</label>
                    <span className="char-counter">{refSlots.filter((s) => s.filled).length} фото</span>
                  </div>
                  <div className="ref-slots">
                    {refSlots.map((slot, slotIdx) => (
                      <div
                        key={slotIdx}
                        className={`ref-slot ${slot.filled ? 'is-filled' : ''} ${slot.locked ? 'is-locked' : ''}`}
                        onClick={() => {
                          if (slot.locked) return
                          customReferenceInputRef.current?.click()
                        }}
                        role="button"
                        tabIndex={slot.locked ? -1 : 0}
                      >
                        {slot.filled && slot.src ? (
                          <>
                            <img src={slot.src} alt={`Референс ${slotIdx + 1}`} />
                            <span
                              className="ref-slot__remove"
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation()
                                setRefSlots((current) => current.map((it, i) => i === slotIdx ? { ...it, filled: false, src: null } : it))
                              }}
                              aria-label="Удалить"
                            >×</span>
                          </>
                        ) : (
                          <>
                            <div className="ref-slot__icon">{slot.locked ? '🔒' : '↑'}</div>
                            <div className="ref-slot__title">Выбрать фото</div>
                            <div className="ref-slot__sub">
                              {slot.locked
                                ? 'Доступно на платном тарифе'
                                : 'или перетащите сюда · PNG, JPG'}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ref-upload-link"
                    onClick={() => customReferenceInputRef.current?.click()}
                  >
                    ↑ Добавить референс
                  </button>
                </div>

                <div className="field-block">
                  <div className="field-label-row">
                    <label>Свои фото</label>
                    <span className="char-counter">{selectedPhotoEntries.length} фото</span>
                  </div>
                  <div className="own-photo-thumbs">
                    {selectedPhotoEntries.map((entry) => (
                      <div key={entry.id} className="own-photo-thumb">
                        <img src={entry.url} alt={entry.albumName} />
                        <button type="button" className="own-photo-thumb__remove" onClick={() => removeSelectedPhoto(entry.id)} aria-label="Удалить">×</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="own-photo-upload" onClick={() => ownPhotoInputRef.current?.click()}>
                    <div className="own-photo-upload__icon">+</div>
                    <div className="own-photo-upload__title">Загрузить фото</div>
                  </button>
                  <input ref={ownPhotoInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleOwnPhotoUpload} />
                </div>

                <div className="generate-row">
                  <button type="button" className="generate-btn" onClick={handleGeneratePreview} disabled={isGenerating}>
                    <span className="generate-btn__icon">✨</span>
                    {isGenerating ? 'Генерация...' : 'Сгенерировать превью'}
                  </button>
                  <div className="generate-price">
                    <span className="generate-price__label">Стоимость генерации</span>
                    <span className="generate-price__value">1 кредит</span>
                  </div>
                </div>
              </div>

              <div className="editor-column right-panel right-panel--studio">
                <div className="result-hero">
                  <h3>Ваше готовое превью</h3>
                  <div className="result-hero__stage">
                    {isGenerating ? (
                      <div className="result-placeholder">
                        <div className="result-placeholder__spinner" />
                        <p>Генерируем...</p>
                      </div>
                    ) : generationError ? (
                      <div className="result-placeholder">
                        <div className="result-placeholder__icon">!</div>
                        <h4>Не удалось создать превью</h4>
                        <p>{generationError}</p>
                      </div>
                    ) : generatedImages.length > 0 ? (
                      <div className="result-hero__grid">
                        {generatedImages.map((image) => (
                          <div key={image.id} className="result-hero__card">
                            <img src={image.url} alt={image.title} />
                            {editingImage === image.id ? (
                              <div className="edit-prompt-area">
                                <textarea
                                  className="prompt-textarea"
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder="Опишите, что нужно изменить..."
                                  rows={3}
                                />
                                <div className="edit-prompt-actions">
                                  <button type="button" className="primary-button" onClick={() => handleEditImage(image)}>Применить</button>
                                  <button type="button" className="ghost-button" onClick={() => { setEditingImage(null); setEditPrompt('') }}>Отмена</button>
                                </div>
                              </div>
                            ) : (
                              <div className="result-hero__actions">
                                <button type="button" className="result-download" onClick={() => downloadGeneratedImage(image.url, `${image.label}.png`)}>Скачать</button>
                                <button type="button" className="result-download" onClick={() => setEditingImage(image.id)}>Редактировать</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="result-placeholder">
                        <div className="result-placeholder__icon">?</div>
                        <p>Здесь появится ваше сгенерированное превью-изображение<br />после клика по кнопке «Сгенерировать»</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <input ref={customReferenceInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleCustomReferenceUpload} />
          </div>
        </div>
      {pickerType && createPortal(
        <div className="picker-overlay" onClick={() => setPickerType(null)}>
          <div className="picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">
              <h3>{pickerType === 'reference' ? 'Выбрать референс' : 'Выбрать фото из альбома'}</h3>
              <button className="ghost-button" type="button" onClick={() => setPickerType(null)}>Закрыть</button>
            </div>
            {pickerType === 'reference' ? (
              <div className="picker-grid">
                {referencePreviews.map((item) => (
                  <button key={item.id} type="button" className="picker-option-card" onClick={() => handleReferenceChange(item)}>
                    <img src={item.preview} alt={item.title} /><span>{item.title}</span>
                  </button>
                ))}
                <button type="button" className="picker-option-card picker-upload-card" onClick={() => customReferenceInputRef.current?.click()}>
                  <div className="picker-upload-placeholder">+</div><span>Загрузить своё фото</span>
                </button>
              </div>
            ) : (
              <div className="album-picker-list">
                {albums.map((album) => (
                  <div key={album.id} className="album-picker-card">
                    <div className="picker-card-header"><div><strong>{album.name}</strong><p>{album.description}</p></div></div>
                    <div className="picker-photo-grid">
                      {album.photos.map((photo, index) => {
                        const isSelected = selectedPhotoEntries.some((entry) => entry.id === `${album.id}-${photo}`)
                        return (
                          <button key={`${album.id}-${photo}-${index}`} type="button" className={`picker-photo-card ${isSelected ? 'selected' : ''}`} onClick={() => toggleSelectedPhoto(photo, album)}>
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
        </div>,
        document.body
      )}
      {presetsOpen && createPortal(
        <div className="picker-overlay" onClick={() => setPresetsOpen(false)}>
          <div className="picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="picker-header">
              <h3>Выбрать прессет</h3>
              <button className="ghost-button" type="button" onClick={() => setPresetsOpen(false)}>Закрыть</button>
            </div>
            <div className="picker-grid">
              {presetsList.map((item) => (
                <button key={item.id} type="button" className="picker-option-card" onClick={() => handlePresetSelect(item)}>
                  <img src={item.preview} alt={item.title} /><span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
      {authModalOpen && (
        <div className="picker-overlay" onClick={() => setAuthModalOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <AuthScreen
              onAuthenticated={() => {
                setIsAuthenticated(true)
                setAuthModalOpen(false)
                setTimeout(() => {
                  if (pendingGeneration) {
                    setPendingGeneration(false)
                    handleGeneratePreview()
                  }
                }, 300)
              }}
              onClose={() => setAuthModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}