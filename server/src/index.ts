import { pool } from '@/db'
import { auth, cors, openapi } from '@/lib'
import { env } from '@/utils/env'
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
  .use(cors)
  .use(openapi)
  .get('/health', async () => {
    const ok = await pool
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false)

    return { status: ok ? 'ok' : 'degraded', db: ok }
  })
  .mount(auth.handler)
  .listen(env.PORT ?? 3000)

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`)
