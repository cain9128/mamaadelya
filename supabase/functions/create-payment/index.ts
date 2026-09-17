const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
// Pure JS MD5 (WebCrypto in Deno does not guarantee MD5 support)
// Written by Joseph Myers, public domain, adapted to string input
function md5(input: string): string {
  function toUtf8Bytes(str: string): number[] {
    const out: number[] = []
    const encoded = new TextEncoder().encode(str)
    for (const byte of encoded) out.push(byte)
    return out
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = (((a + q) | 0) + ((x + t) | 0)) | 0
    return (((a << s) | (a >>> (32 - s))) + b) | 0
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t)
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t)
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t)
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t)
  }

  function md5cycle(x: number[], k: number[]) {
    let [a, b, c, d] = x

    a = ff(a, b, c, d, k[0], 7, -680876936)
    d = ff(d, a, b, c, k[1], 12, -389564586)
    c = ff(c, d, a, b, k[2], 17, 606105819)
    b = ff(b, c, d, a, k[3], 22, -1044525330)
    a = ff(a, b, c, d, k[4], 7, -176418897)
    d = ff(d, a, b, c, k[5], 12, 1200080426)
    c = ff(c, d, a, b, k[6], 17, -1473231341)
    b = ff(b, c, d, a, k[7], 22, -45705983)
    a = ff(a, b, c, d, k[8], 7, 1770035416)
    d = ff(d, a, b, c, k[9], 12, -1958414417)
    c = ff(c, d, a, b, k[10], 17, -42063)
    b = ff(b, c, d, a, k[11], 22, -1990404162)
    a = ff(a, b, c, d, k[12], 7, 1804603682)
    d = ff(d, a, b, c, k[13], 12, -40341101)
    c = ff(c, d, a, b, k[14], 17, -1502002290)
    b = ff(b, c, d, a, k[15], 22, 1236535329)

    a = gg(a, b, c, d, k[1], 5, -165796510)
    d = gg(d, a, b, c, k[6], 9, -1069501632)
    c = gg(c, d, a, b, k[11], 14, 643717713)
    b = gg(b, c, d, a, k[0], 20, -373897302)
    a = gg(a, b, c, d, k[5], 5, -701558691)
    d = gg(d, a, b, c, k[10], 9, 38016083)
    c = gg(c, d, a, b, k[15], 14, -660478335)
    b = gg(b, c, d, a, k[4], 20, -405537848)
    a = gg(a, b, c, d, k[9], 5, 568446438)
    d = gg(d, a, b, c, k[14], 9, -1019803690)
    c = gg(c, d, a, b, k[3], 14, -187363961)
    b = gg(b, c, d, a, k[8], 20, 1163531501)
    a = gg(a, b, c, d, k[13], 5, -1444681467)
    d = gg(d, a, b, c, k[2], 9, -51403784)
    c = gg(c, d, a, b, k[7], 14, 1735328473)
    b = gg(b, c, d, a, k[12], 20, -1926607734)

    a = hh(a, b, c, d, k[5], 4, -378558)
    d = hh(d, a, b, c, k[8], 11, -2022574463)
    c = hh(c, d, a, b, k[11], 16, 1839030562)
    b = hh(b, c, d, a, k[14], 23, -35309556)
    a = hh(a, b, c, d, k[1], 4, -1530992060)
    d = hh(d, a, b, c, k[4], 11, 1272893353)
    c = hh(c, d, a, b, k[7], 16, -155497632)
    b = hh(b, c, d, a, k[10], 23, -1094730640)
    a = hh(a, b, c, d, k[13], 4, 681279174)
    d = hh(d, a, b, c, k[0], 11, -358537222)
    c = hh(c, d, a, b, k[3], 16, -722521979)
    b = hh(b, c, d, a, k[6], 23, 76029189)
    a = hh(a, b, c, d, k[9], 4, -640364487)
    d = hh(d, a, b, c, k[12], 11, -421815835)
    c = hh(c, d, a, b, k[15], 16, 530742520)
    b = hh(b, c, d, a, k[2], 23, -995338651)

    a = ii(a, b, c, d, k[0], 6, -198630844)
    d = ii(d, a, b, c, k[7], 10, 1126891415)
    c = ii(c, d, a, b, k[14], 15, -1416354905)
    b = ii(b, c, d, a, k[5], 21, -57434055)
    a = ii(a, b, c, d, k[12], 6, 1700485571)
    d = ii(d, a, b, c, k[3], 10, -1894986606)
    c = ii(c, d, a, b, k[10], 15, -1051523)
    b = ii(b, c, d, a, k[1], 21, -2054922799)
    a = ii(a, b, c, d, k[8], 6, 1873313359)
    d = ii(d, a, b, c, k[15], 10, -30611744)
    c = ii(c, d, a, b, k[6], 15, -1560198380)
    b = ii(b, c, d, a, k[13], 21, 1309151649)
    a = ii(a, b, c, d, k[4], 6, -145523070)
    d = ii(d, a, b, c, k[11], 10, -1120210379)
    c = ii(c, d, a, b, k[2], 15, 718787259)
    b = ii(b, c, d, a, k[9], 21, -343485551)

    x[0] = (x[0] + a) | 0
    x[1] = (x[1] + b) | 0
    x[2] = (x[2] + c) | 0
    x[3] = (x[3] + d) | 0
  }

  function md5blk(bytes: number[], offset: number): number[] {
    const blk: number[] = []
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4
      blk[i] = bytes[j] + (bytes[j + 1] << 8) + (bytes[j + 2] << 16) + (bytes[j + 3] << 24)
    }
    return blk
  }

  function md51(bytes: number[]): number[] {
    const n = bytes.length
    const state = [1732584193, -271733879, -1732584194, 271733878]
    let i: number
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(bytes, i - 64))
    }
    const tail = bytes.slice(i - 64)
    const blocks = new Array(16).fill(0)
    for (i = 0; i < tail.length; i++) {
      blocks[i >> 2] |= tail[i] << ((i % 4) << 3)
    }
    blocks[i >> 2] |= 0x80 << ((i % 4) << 3)
    if (i > 55) {
      md5cycle(state, blocks)
      for (i = 0; i < 16; i++) blocks[i] = 0
    }
    blocks[14] = n * 8
    md5cycle(state, blocks)
    return state
  }

  function rhex(n: number): string {
    const hexChr = '0123456789abcdef'
    let s = ''
    for (let j = 0; j < 4; j++) {
      s += hexChr[(n >> ((j << 3) + 4)) & 0x0f] + hexChr[(n >> (j << 3)) & 0x0f]
    }
    return s
  }

  const bytes = toUtf8Bytes(input)
  return md51(bytes).map(rhex).join('')
}

const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const ROBOKASSA_LOGIN = Deno.env.get('ROBOKASSA_LOGIN') ?? ''
const ROBOKASSA_PASSWORD1 = Deno.env.get('ROBOKASSA_PASSWORD1') ?? ''
const ROBOKASSA_IS_TEST = Deno.env.get('ROBOKASSA_IS_TEST') === 'true'
const ROBOKASSA_SUCCESS_URL = Deno.env.get('ROBOKASSA_SUCCESS_URL') ?? ''

const plans = {
  tokens3: { name: '3 токена без срока действия', price: 270, credits: 3 },
  creator: { name: 'Креатор', price: 890, credits: 14 },
  blogger: { name: 'Блогер', price: 1390, credits: 24 },
  studio: { name: 'Студия УЛЬТРАВЫГОДА', price: 2550, credits: 60 },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405)
  }

  if (!ROBOKASSA_LOGIN || !ROBOKASSA_PASSWORD1) {
    return jsonResponse({ error: 'Robokassa не настроен. Обратитесь в поддержку.' }, 500)
  }

  try {
    const user = await getUser(request)
    if (!user?.id) {
      return jsonResponse({ error: 'Требуется авторизация.' }, 401)
    }

    const { planId } = await request.json()
    const plan = plans[planId]

    if (!plan) {
      return jsonResponse({ error: 'Неизвестный тариф.' }, 400)
    }

    // Generate a unique integer invoice id for Robokassa (InvId)
    // 13 digits: unix-seconds (10) + 3-digit random suffix
    const robokassaInvId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000)

    const paymentResp = await fetch(`${supabaseUrl}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: planId,
        plan_name: plan.name,
        credits: plan.credits,
        amount: plan.price,
        status: 'pending',
        robokassa_inv_id: robokassaInvId,
      }),
    })

    if (!paymentResp.ok) {
      return jsonResponse({ error: 'Не удалось создать платёж.' }, 500)
    }

    const payment = (await paymentResp.json())[0]

    // Build Robokassa payment URL
    // Signature: MD5(MrchLogin:OutSum:InvId:Password1)
    const description = `PreviewGen: тариф ${plan.name} — ${plan.credits} кредитов`
    const outSum = `${plan.price}.00`
    const signatureString = `${ROBOKASSA_LOGIN}:${outSum}:${robokassaInvId}:${ROBOKASSA_PASSWORD1}`
    const signatureValue = md5(signatureString)

    const params = new URLSearchParams({
      MerchantLogin: ROBOKASSA_LOGIN,
      OutSum: outSum,
      InvId: String(robokassaInvId),
      Description: description,
      SignatureValue: signatureValue,
      Culture: 'ru',
      Encoding: 'utf-8',
      Email: user.email ?? '',
    })

    const successUrl = ROBOKASSA_SUCCESS_URL || `${request.headers.get('origin') || 'https://previewgen.ru'}/profile?payment=success`
    // ВАЖНО: параметр SuccessUrl2 НЕ передаём — Robokassa разрешает его только при типе
    // Success URL «URL2» в технических настройках ЛК. При схеме URL1 запрос с ним
    // отклоняется ошибкой 29 («оплата недоступна»). Редирект после успешной оплаты
    // выполняется по Success URL, заданному в технических настройках ЛК.
    let failUrl = 'https://previewgen.ru/profile?payment=fail'
    try {
      failUrl = `${new URL(successUrl).origin}/profile?payment=fail`
    } catch {
      // keep default failUrl if successUrl is not absolute
    }
    params.set('FailUrl', failUrl)
    if (ROBOKASSA_IS_TEST) {
      params.set('IsTest', '1')
    }

    const paymentUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`

    return jsonResponse({
      paymentId: payment.id,
      paymentUrl,
      plan: plan.name,
      amount: plan.price,
      credits: plan.credits,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
