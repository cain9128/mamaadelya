const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const YOOMONEY_SECRET = Deno.env.get('YOOMONEY_NOTIFICATION_SECRET') ?? ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: corsHeaders })
}

async function sha1Hash(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return textResponse('error', 405)
  }

  try {
    const body = await request.text()
    const params = new URLSearchParams(body)

    const notificationType = params.get('notification_type') || ''
    const operationId = params.get('operation_id') || ''
    const amount = params.get('amount') || ''
    const currency = params.get('currency') || ''
    const datetime = params.get('datetime') || ''
    const sender = params.get('sender') || ''
    const codepro = params.get('codepro') || ''
    const label = params.get('label') || ''
    const signature = params.get('sha1_hash') || ''

    // Build the string to verify signature
    // Format: notification_type&operation_id&amount&currency&datetime&sender&codepro&notification_secret&label
    const signatureString = [
      notificationType,
      operationId,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      YOOMONEY_SECRET,
      label,
    ].join('&')

    const expectedHash = await sha1Hash(signatureString)

    if (expectedHash !== signature) {
      console.error('YooMoney notification: invalid signature')
      return textResponse('error', 403)
    }

    if (codepro === 'true') {
      // Payment is protected by code — cannot confirm automatically
      console.log(`YooMoney: payment ${label} has code protection, skipping`)
      return textResponse('ok', 200)
    }

    if (!label) {
      console.error('YooMoney: missing label in notification')
      return textResponse('error', 400)
    }

    // Update payment status and add credits to user
    const paymentId = label

    // Get the payment record
    const paymentResp = await fetch(
      `${supabaseUrl}/rest/v1/payments?id=eq.${paymentId}&select=id,user_id,plan_id,plan_name,credits,status`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    )

    if (!paymentResp.ok) {
      console.error('YooMoney: failed to fetch payment')
      return textResponse('error', 500)
    }

    const payments = await paymentResp.json()
    if (!payments.length) {
      console.error(`YooMoney: payment not found for label ${label}`)
      return textResponse('error', 404)
    }

    const payment = payments[0]

    if (payment.status === 'completed') {
      // Already processed
      return textResponse('ok', 200)
    }

    // Update payment status to completed
    await fetch(`${supabaseUrl}/rest/v1/payments?id=eq.${paymentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        status: 'completed',
        yoomoney_payment_id: operationId,
      }),
    })

    // Add credits to user
    await fetch(`${supabaseUrl}/rest/v1/rpc/add_credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_user_id: payment.user_id,
        p_amount: payment.credits,
      }),
    })

    // Update user's plan and subscription expiration (30 days from now)
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${payment.user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        plan: payment.plan_name,
        subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    })

    console.log(`YooMoney: added ${payment.credits} credits, updated plan to ${payment.plan_name}, subscription expires in 30 days for user ${payment.user_id}`)
    return textResponse('ok', 200)
  } catch (error) {
    console.error('YooMoney notification error:', error)
    return textResponse('error', 500)
  }
})
