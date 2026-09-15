import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getProfile, createProfile } from './lib/profile'
import {
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

const TARGET_WIDTH = 1280
const TARGET_HEIGHT = 720

const resizeImageTo1280x720 = (imageUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = TARGET_WIDTH
      canvas.height = TARGET_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Не удалось получить контекст canvas'))
        return
      }

      // Cover-fit: scale to fill 1280x720, cropping any overflow
      const scale = Math.max(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      const offsetX = (TARGET_WIDTH - scaledWidth) / 2
      const offsetY = (TARGET_HEIGHT - scaledHeight) / 2

      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Не удалось загрузить изображение для ресайза'))
    img.src = imageUrl
  })


const formatMeta = {
  '16x9': { label: 'YouTube 16:9', aspectRatio: '16:9' },
}

const buildNanoBananaPrompt = ({ referenceImage, selectedPhotoEntries, text, extraWishes, refSlots, previewFormat }) => {
  const sourceEntries = (selectedPhotoEntries || [])
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.albumName}: ${entry.description}\n- ${entry.url}`,
    )
    .join('\n\n')
  const hasSources = (selectedPhotoEntries || []).length > 0

  const formatInfo = formatMeta[previewFormat] || formatMeta['16x9']
  const refEntries = (refSlots || [])
    .filter((slot) => slot.filled && slot.src)
    .map((slot, index) => `${index + 1}. Референсное фото: ${slot.src}`)
    .join('\n')

  const sourcesBlock = hasSources
    ? `Исходники:\n${sourceEntries}`
    : 'Исходных фото нет — создай изображение полностью с нуля по текстовому описанию ниже.'

  return `Создай YouTube-превью в формате ${formatInfo.label}\n\nРеференсный стиль: ${referenceImage || 'Не выбрано'}. Старайся сделать максимально близко к оригиналу. Используй как направление по композиции, контрасту, динамике и общему вайбу.\n${refEntries ? `Референсные изображения:\n${refEntries}\n` : ''}\n${sourcesBlock}\n\nТекст на превью: ${text || 'Без текста'}. Сделай надпись крупной, легко читаемой и органично встроенной в композицию.\n\n${extraWishes || 'Дополнительные пожелания: сохрани баланс между текстом и изображением, не перегружай композицию, оставь сильный визуальный фокус на главном объекте.'}`
}

const buildNanoBananaRequestPayload = ({ referenceImage, selectedPhotoEntries, text, extraWishes, refSlots, previewFormat }) => {
  const sources = selectedPhotoEntries || []

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

export function AuthScreen({ onAuthenticated, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleAuth = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
            setMessage('Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.')
            return
          }
          throw error
        }
        if (data.user && !data.user.email_confirmed_at) {
          setMessage('Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.')
          return
        }
        localStorage.setItem('previewforge-current-user', JSON.stringify({ email, name: email.split('@')[0], id: data.user?.id }))
        setMessage('Вход выполнен.')
        onAuthenticated?.()
        return
      }
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (data.user) {
          localStorage.setItem('previewforge-current-user', JSON.stringify({ email, name: email.split('@')[0], id: data.user?.id }))
          if (data.session) {
            setMessage('Регистрация успешна! Вы уже вошли.')
            onAuthenticated?.()
          } else {
            setMessage('Регистрация создана! Проверьте почту и перейдите по ссылке для подтверждения email.')
            setMode('login')
          }
        }
        return
      }
      if (mode === 'reset') {
        if (code.length !== 6) throw new Error('Введите 6-значный код из письма.')
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
        if (error) throw error
        setMessage('Код подтверждён. Теперь можно войти в аккаунт.')
        setMode('login')
        return
      }
    } catch (error) {
      setMessage(error.message || 'Произошла ошибка.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) { setMessage('Укажите email для повторной отправки письма.'); return }
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      setMessage('Письмо с подтверждением отправлено повторно. Проверьте почту.')
      setResendCooldown(60)
    } catch (error) {
      setMessage(error.message || 'Не удалось отправить письмо.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setMessage('Сначала укажите email для сброса пароля.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      setMessage('Код сброса отправлен на почту. Введите 6 цифр ниже.')
      setMode('reset')
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
          {mode === 'login' && (
            <button type="button" className="link-button" onClick={handleResendConfirmation} disabled={loading || resendCooldown > 0}>
              {resendCooldown > 0 ? `Повторить через ${resendCooldown}с` : 'Повторно отправить письмо с подтверждением'}
            </button>
          )}
          {mode !== 'reset' && (
            <button type="button" className="link-button" onClick={handleForgotPassword} disabled={loading}>Забыли пароль?</button>
          )}
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [, setPrompt] = useState(defaultPrompt)
  const [editorOpen, setEditorOpen] = useState(false)
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
  const [profileData, setProfileData] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pendingGeneration, setPendingGeneration] = useState(false)
  const displayProfile = {
    name: currentUser?.name || profileData?.full_name || profile.name,
    email: currentUser?.email || profileData?.email || profile.email,
    plan: currentUser?.plan || profileData?.plan || profile.plan,
    credits: currentUser?.credits ?? profileData?.credits ?? profile.credits,
  }

  const inputRef = useRef(null)
  const customReferenceInputRef = useRef(null)
  const ownPhotoInputRef = useRef(null)
  const ownPhotoIdRef = useRef(0)
  const navigate = useNavigate()

  const loadSupabaseProfile = async (userId, email) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && !session.user.email_confirmed_at) {
        return
      }
      let data = await getProfile(userId)
      if (!data) {
        data = await createProfile({ userId, email, fullName: email?.split('@')[0] })
      }
      if (data && !cancelled) {
        setProfileData(data)
        setCurrentUser((prev) => ({ ...prev, id: userId, email, credits: data.credits, plan: data.plan }))
      }
    } catch {
      // ignore profile load error
    }
  }

  useEffect(() => {
    let cancelled = false
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session?.user && session.user.email_confirmed_at) {
          setIsAuthenticated(true)
          setCurrentUser({ email: session.user.email, id: session.user.id })
          await loadSupabaseProfile(session.user.id, session.user.email)
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user && session.user.email_confirmed_at) {
          setIsAuthenticated(true)
          setCurrentUser({ email: session.user.email, id: session.user.id })
          loadSupabaseProfile(session.user.id, session.user.email)
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
          setCurrentUser(null)
          setProfileData(null)
        }
      })
      return () => { cancelled = true; subscription.unsubscribe() }
    } catch {
      return () => { cancelled = true }
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch { /* ignore */ }
    localStorage.removeItem('previewforge-current-user')
    setIsAuthenticated(false)
    setCurrentUser(null)
    setProfileData(null)
    navigate('/')
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
      navigate('/studio/presets')
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
    if ((displayProfile.credits ?? 0) <= 0) {
      setGenerationError('Недостаточно кредитов. Приобретите тариф для продолжения.')
      return
    }
    const sourceEntries = selectedPhotoEntries || []
    const hasAnyVisualInput = sourceEntries.length > 0 || selectedReference?.preview || (refSlots || []).some((slot) => slot.filled && slot.src)
    if (!hasAnyVisualInput && !previewText.trim() && !extraWishes.trim()) {
      setGenerationError('Опишите, что сгенерировать: добавьте текст превью или пожелания, либо загрузите фото/референс.')
      return
    }
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
      const { data: userData, error: userError } = await supabase.rpc('consume_credit', { p_user_id: currentUser?.id })
      if (userError) {
        throw new Error('Недостаточно кредитов. Приобретите тариф для продолжения.')
      }
      setProfileData((prev) => prev ? { ...prev, credits: userData } : prev)

      const { data, error } = await supabase.functions.invoke('generate-preview', { body: { requestPayload, variants: 1 } })
      if (error) throw error
      if (!data?.images?.length) throw new Error('OpenRouter не вернул изображения.')
      const resizedImages = await Promise.all(
        data.images.map((url) => resizeImageTo1280x720(url))
      )
      setGeneratedImages(resizedImages.map((url, index) => ({
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
    if ((displayProfile.credits ?? 0) <= 0) {
      setGenerationError('Недостаточно кредитов. Приобретите тариф для продолжения.')
      return
    }

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
      const { data: userData, error: userError } = await supabase.rpc('consume_credit', { p_user_id: currentUser?.id })
      if (userError) {
        throw new Error('Недостаточно кредитов. Приобретите тариф для продолжения.')
      }
      setProfileData((prev) => prev ? { ...prev, credits: userData } : prev)

      const { data, error } = await supabase.functions.invoke('generate-preview', {
        body: { requestPayload, variants: 1 }
      })
      if (error) throw error
      if (!data?.images?.length) throw new Error('OpenRouter не вернул изображения.')
      const resizedImages = await Promise.all(
        data.images.map((url) => resizeImageTo1280x720(url))
      )
      setGeneratedImages(resizedImages.map((url, index) => ({
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
          <NavLink to="/profile" className="profile-top-btn" aria-label="Профиль">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </NavLink>
          <a href="https://t.me/PreviewGen" className="tg-badge tg-badge--studio-mobile" target="_blank" rel="noopener noreferrer" aria-label="Telegram" style={{ display: 'none' }}>
            <svg viewBox="0 0 1000 1000" width="18" height="18" fill="currentColor"><path transform="translate(-289.1496 -403.6047) scale(1.713884)" d="M226.328419,494.722069 C372.088573,431.216685 469.284839,389.350049 517.917216,369.122161 C656.772535,311.36743 685.625481,301.334815 704.431427,301.003532 C708.567621,300.93067 717.815839,301.955743 723.806446,306.816707 C728.864797,310.92121 730.256552,316.46581 730.922551,320.357329 C731.588551,324.248848 732.417879,333.113828 731.758626,340.040666 C724.234007,419.102486 691.675104,610.964674 675.110982,699.515267 C668.10208,736.984342 654.301336,749.547532 640.940618,750.777006 C611.904684,753.448938 589.856115,731.588035 561.733393,713.153237 C517.726886,684.306416 492.866009,666.349181 450.150074,638.200013 C400.78442,605.66878 432.786119,587.789048 460.919462,558.568563 C468.282091,550.921423 596.21508,434.556479 598.691227,424.000355 C599.00091,422.680135 599.288312,417.758981 596.36474,415.160431 C593.441168,412.561881 589.126229,413.450484 586.012448,414.157198 C581.598758,415.158943 511.297793,461.625274 375.109553,553.556189 C355.154858,567.258623 337.080515,573.934908 320.886524,573.585046 C303.033948,573.199351 268.692754,563.490928 243.163606,555.192408 C211.851067,545.013936 186.964484,539.632504 189.131547,522.346309 C190.260287,513.342589 202.659244,504.134509 226.328419,494.722069 Z" fill="currentColor"/></svg>
          </a>
        </div>

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
                    <span className="char-counter">{previewText.length} / 1024</span>
                  </div>
                  <div className="prompt-textarea-wrapper">
                    <textarea
                      className="prompt-textarea"
                      value={previewText}
                      onChange={handleTextChange}
                      maxLength={1024}
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
                    Советую всегда использовать референс для более точной генерации. После генерации вы можете внести свои правки, нажав кнопку «Редактировать».



В промпте подробно описывайте все детали, которые хотите получить. Если вы хотите использовать референс, но не хотите, чтобы нейросеть копировала его 1 в 1, просто напишите подробный промпт с конкретными указаниями: что хотите видеть в конечной генерации, нейросеть подстроится под вас и будет учитывать референс только как желаемый стиль оформления.
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