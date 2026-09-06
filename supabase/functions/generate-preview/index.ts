const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const openRouterUrl = 'https://openrouter.ai/api/v1/images'
const defaultModel = "google/gemini-3-pro-image-preview"

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

    return jsonResponse({ images })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
