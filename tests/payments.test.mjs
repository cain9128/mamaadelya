import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transformWithOxc } from 'vite'
import { createHash } from 'node:crypto'

const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const hash = (value) => createHash('md5').update(value).digest('hex')

async function loadHandler(name, fetch) {
  const path = new URL(`../supabase/functions/${name}/index.ts`, import.meta.url)
  const { code } = await transformWithOxc(await readFile(path, 'utf8'), path.pathname)
  let handler
  vm.runInNewContext(code, {
    Deno: {
      env: { get: (key) => ({
        SUPABASE_URL: 'https://database.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        ROBOKASSA_LOGIN: 'test-shop', ROBOKASSA_PASSWORD1: 'test-password',
        ROBOKASSA_PASSWORD2: 'test-password', ROBOKASSA_IS_TEST: 'true',
      })[key] },
      serve: (callback) => { handler = callback },
    },
    fetch, Response, Request, URL, URLSearchParams, TextEncoder,
    console: { log() {}, error() {} },
  })
  return handler
}

test('creates a 270 RUB payment for 3 credits, without client-side pricing', async () => {
  let saved
  const handler = await loadHandler('create-payment', async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return json({ id: 'user', email: 'test@example.com' })
    assert.equal(url, 'https://database.test/rest/v1/payments')
    saved = JSON.parse(options.body)
    return json([{ id: 'payment' }])
  })
  const response = await handler(new Request('https://local.test', {
    method: 'POST', headers: { Authorization: 'Bearer test' },
    body: JSON.stringify({ planId: 'tokens3', price: 1, credits: 999 }),
  }))
  assert.equal(response.status, 200)
  assert.equal(saved.amount, 270)
  assert.equal(saved.credits, 3)
  assert.equal(saved.plan_id, 'tokens3')
  const { paymentUrl } = await response.json()
  const params = new URL(paymentUrl).searchParams
  assert.equal(params.get('OutSum'), '270.00')
  assert.equal(params.get('IsTest'), '1')
})

for (const name of ['verify-payment', 'robokassa-result']) {
  for (const scenario of ['success', 'repeat', 'failure']) {
    test(`${name}: ${scenario} uses atomic completion and checks its result`, async () => {
      let completions = 0
      const handler = await loadHandler(name, async (url, options) => {
        assert.notEqual(options?.method, 'PATCH')
        if (url.includes('/payments?')) return json([{
          id: 'payment', user_id: 'user', plan_id: 'tokens3', plan_name: '3 токена',
          credits: 3, amount: 270, status: 'pending',
        }])
        if (url.endsWith('/rpc/complete_payment')) {
          completions++
          assert.deepEqual(JSON.parse(options.body), { p_payment_id: 'payment' })
          return json({ alreadyProcessed: scenario === 'repeat' }, scenario === 'failure' ? 500 : 200)
        }
        assert.ok(url.includes('/profiles?'))
        return json([{ credits: 3, plan: 'Старт', subscription_expires_at: null }])
      })
      const signature = hash('270.00:123:test-password')
      const request = name === 'verify-payment'
        ? new Request('https://local.test', { method: 'POST', body: JSON.stringify({ outSum: '270.00', invId: '123', signature }) })
        : new Request(`https://local.test?OutSum=270.00&InvId=123&SignatureValue=${signature}`)
      const response = await handler(request)
      assert.equal(completions, 1)
      assert.equal(response.status, scenario === 'failure' ? 500 : 200)
      if (name === 'verify-payment' && scenario !== 'failure') {
        const body = await response.json()
        assert.equal(body.alreadyProcessed, scenario === 'repeat')
        assert.equal(body.profile.credits, 3)
      }
    })
  }
}
