const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const openRouterUrl = 'https://openrouter.ai/api/v1/images'
const defaultModel = "google/gemini-3-pro-image-preview"

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getImageUrl(response: any) {
  const image = response?.data?.[0]
  if (!image?.b64_json) return null

  return `data:${image.media_type || 'image/png'};base64,${image.b64_json}`
}

async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null

  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: supabaseKey,
    },
  })
  if (!resp.ok) return null
  return await resp.json()
}

async function consumeCredit(userId: string): Promise<number> {
  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_credit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    if (body.includes('insufficient_credits')) {
      throw { code: 'insufficient_credits' }
    }
    throw { code: 'credit_error', body }
  }

  return await resp.json()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405)
  }

  const openRouterKey = Deno.env.get('OPENROUTER_KEY')
  if (!openRouterKey) {
    return jsonResponse({ error: 'OPENROUTER_KEY is not configured.' }, 500)
  }

  try {
    // Authenticate user and consume 1 credit before generating
    const user = await getUser(request)
    if (!user?.id) {
      return jsonResponse({ error: 'Требуется авторизация.' }, 401)
    }

    let remainingCredits: number
    try {
      remainingCredits = await consumeCredit(user.id)
    } catch (err: any) {
      if (err?.code === 'insufficient_credits') {
        return jsonResponse({ error: 'Недостаточно кредитов. Приобретите тариф для продолжения.' }, 402)
      }
      return jsonResponse({ error: 'Не удалось проверить кредиты. Попробуйте позже.' }, 500)
    }

    const { requestPayload, variants = 1 } = await request.json()
    const aspectRatio = requestPayload?.aspect_ratio || '16:9'
    const message = requestPayload?.messages?.[0]
    if (!message?.content) {
      return jsonResponse({ error: 'A request payload with image content is required.' }, 400)
    }

    const model = Deno.env.get('OPENROUTER_MODEL') || defaultModel
    const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }]
    const prompt = content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n')
    const inputReferences = content
      .filter((part: any) => part.type === 'image_url')
      .map((part: any) => ({
        type: 'image_url',
        image_url: part.image_url,
      }))
    const images: string[] = []
    const count = Math.min(Math.max(Number(variants) || 1, 1), 3)

    const isGeminiImageModel = model.includes('gemini') && model.includes('image')
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      input_references: inputReferences,
    }

    if (isGeminiImageModel) {
      requestBody.modalities = ['image', 'text']
      requestBody.aspect_ratio = aspectRatio
      requestBody.image_config = { aspect_ratio: aspectRatio }
    } else {
      requestBody.aspect_ratio = aspectRatio
    }

    for (let index = 0; index < count; index += 1) {
      const response = await fetch(openRouterUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'PrewievGen Preview Studio',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      if (!response.ok) {
        return jsonResponse({ error: result?.error?.message || 'OpenRouter request failed.' }, 502)
      }

      const imageUrl = getImageUrl(result)
      if (imageUrl) images.push(imageUrl)
    }

    if (!images.length) {
      return jsonResponse({ error: 'OpenRouter returned no images.' }, 502)
    }

    return jsonResponse({ images, remainingCredits })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
