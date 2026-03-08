import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

---

## Phase 4 — API Routes

Create this folder structure inside your project:
```
app/
  api/
    auth/
      create-tenant/
        route.js
    payments/
      create/
        route.js
    webhooks/
      stripe/
        route.js
