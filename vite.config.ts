import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ViteDevServer } from 'vite';

// Tool declarations for Gemini function calling
const FINANCIAL_TOOLS = [
  {
    function_declarations: [
      {
        name: 'register_transaction',
        description: 'Registra un gasto, ingreso o movimiento NUEVO en la base de datos. Usa esta función SOLO para registrar transacciones nuevas. Si el usuario quiere corregir o modificar una transacción existente, usa update_transaction en su lugar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            description: {
              type: 'STRING',
              description: 'Descripción del movimiento, ej: "Ropa para Helena", "Nómina quincenal"',
            },
            amount: {
              type: 'NUMBER',
              description: 'Monto positivo en pesos mexicanos. Siempre positivo, el tipo determina si es gasto o ingreso.',
            },
            type: {
              type: 'STRING',
              description: 'Tipo de movimiento: "expense" para gastos, "income" para ingresos',
              enum: ['expense', 'income'],
            },
            account_name: {
              type: 'STRING',
              description: 'Nombre de la cuenta/tarjeta como la conoce el usuario. Se buscará el ID real.',
            },
            category_name: {
              type: 'STRING',
              description: 'Nombre de la categoría. Se buscará el ID real en las categorías del usuario.',
            },
            transaction_date: {
              type: 'STRING',
              description: 'Fecha en formato YYYY-MM-DD. Si no se indica, usar la fecha de hoy.',
            },
          },
          required: ['description', 'amount', 'type', 'account_name', 'category_name', 'transaction_date'],
        },
      },
      {
        name: 'update_transaction',
        description: 'Modifica una transacción EXISTENTE. Usa esto cuando el usuario quiera corregir la fecha, monto, descripción, cuenta o categoría de una transacción que acaba de registrar o una existente. NUNCA crees una transacción nueva para corregir — siempre usa update.',
        parameters: {
          type: 'OBJECT',
          properties: {
            transaction_id: {
              type: 'STRING',
              description: 'UUID de la transacción a modificar. Búscalo en las transacciones recientes del contexto.',
            },
            description: {
              type: 'STRING',
              description: 'Nueva descripción (solo si cambia)',
            },
            amount: {
              type: 'NUMBER',
              description: 'Nuevo monto positivo (solo si cambia)',
            },
            type: {
              type: 'STRING',
              description: 'Nuevo tipo (solo si cambia)',
              enum: ['expense', 'income'],
            },
            account_name: {
              type: 'STRING',
              description: 'Nuevo nombre de cuenta (solo si cambia)',
            },
            category_name: {
              type: 'STRING',
              description: 'Nueva categoría (solo si cambia)',
            },
            transaction_date: {
              type: 'STRING',
              description: 'Nueva fecha YYYY-MM-DD (solo si cambia)',
            },
          },
          required: ['transaction_id'],
        },
      },
      {
        name: 'delete_transaction',
        description: 'Elimina una transacción existente. Usa esto cuando el usuario quiera borrar o cancelar una transacción. Pide confirmación al usuario antes de eliminar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            transaction_id: {
              type: 'STRING',
              description: 'UUID de la transacción a eliminar.',
            },
            reason: {
              type: 'STRING',
              description: 'Razón de la eliminación para el log.',
            },
          },
          required: ['transaction_id'],
        },
      },
    ],
  },
];

// ── Rate Limiter ──────────────────────────────────────────────
const rateLimiter = {
  requests: [] as number[],
  maxPerMinute: 8,  // Keep below Gemini's 10 RPM to leave headroom
  cooldownUntil: 0, // Timestamp when cooldown ends

  canProceed(): boolean {
    const now = Date.now();
    if (now < this.cooldownUntil) return false;
    // Remove requests older than 60 seconds
    this.requests = this.requests.filter(t => now - t < 60_000);
    return this.requests.length < this.maxPerMinute;
  },

  record(): void {
    this.requests.push(Date.now());
  },

  setCooldown(seconds: number): void {
    this.cooldownUntil = Date.now() + seconds * 1000;
    console.log(`[AI Copilot] Rate limit cooldown: ${seconds}s`);
  },

  getWaitSeconds(): number {
    if (Date.now() < this.cooldownUntil) {
      return Math.ceil((this.cooldownUntil - Date.now()) / 1000);
    }
    if (this.requests.length >= this.maxPerMinute) {
      const oldest = this.requests[0];
      return Math.ceil((oldest + 60_000 - Date.now()) / 1000);
    }
    return 0;
  },
};

// ── Cached Financial Context ─────────────────────────────────
let cachedContext: { data: any; timestamp: number; token: string } | null = null;
const CONTEXT_CACHE_TTL = 30_000; // 30 seconds

function geminiProxyPlugin(): Plugin {
  return {
    name: 'gemini-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const env = loadEnv('', process.cwd(), '');
        const GEMINI_KEY = env.GEMINI_API_KEY;
        const SUPABASE_URL = env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

        if (!GEMINI_KEY) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }));
          return;
        }

        // Rate limit check
        if (!rateLimiter.canProceed()) {
          const wait = rateLimiter.getWaitSeconds();
          res.statusCode = 429;
          res.end(JSON.stringify({
            error: `⏳ Demasiadas consultas. Espera ${wait} segundos antes de enviar otro mensaje.`,
            retryAfter: wait,
          }));
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        let parsed: { message: string; history: any[]; accessToken: string };
        try {
          parsed = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        try {
          // Use cached context if available and fresh
          let financialContext: any;
          const now = Date.now();
          if (cachedContext && cachedContext.token === parsed.accessToken && (now - cachedContext.timestamp) < CONTEXT_CACHE_TTL) {
            financialContext = cachedContext.data;
          } else {
            financialContext = await buildFinancialContext(
              SUPABASE_URL, SUPABASE_KEY, parsed.accessToken
            );
            cachedContext = { data: financialContext, timestamp: now, token: parsed.accessToken };
          }

          const systemPrompt = buildSystemPrompt(financialContext);

          const contents: any[] = [
            ...(parsed.history || []).map((msg: any) => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            })),
            { role: 'user', parts: [{ text: parsed.message }] },
          ];

          // Call Gemini with tools (function calling enabled)
          let reply = '';
          let actionResult: any = null;
          const MAX_TOOL_ROUNDS = 3;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            rateLimiter.record(); // Count each Gemini API call

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemPrompt }] },
                  contents,
                  tools: FINANCIAL_TOOLS,
                  tool_config: { function_calling_config: { mode: 'AUTO' } },
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    topP: 0.9,
                  },
                }),
              }
            );

            // Handle Gemini rate limit (429)
            if (geminiRes.status === 429) {
              const retryAfter = parseInt(geminiRes.headers.get('retry-after') || '60', 10);
              rateLimiter.setCooldown(retryAfter);
              res.statusCode = 429;
              res.end(JSON.stringify({
                error: `⏳ Se alcanzó el límite de la API de Gemini. Espera ${retryAfter} segundos. La cuota se renueva a las 2:00 AM.`,
                retryAfter,
              }));
              return;
            }

            const geminiData: any = await geminiRes.json();
            if (geminiData.error) {
              // Check for quota exceeded errors
              const errMsg = geminiData.error.message || '';
              if (errMsg.includes('quota') || errMsg.includes('RATE_LIMIT') || errMsg.includes('429')) {
                rateLimiter.setCooldown(60);
                res.statusCode = 429;
                res.end(JSON.stringify({
                  error: '⏳ Se agotó la cuota diaria de Gemini. La cuota se renueva a las 2:00 AM (hora CDMX). Intenta mañana.',
                  retryAfter: 3600,
                }));
                return;
              }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: geminiData.error.message || 'Gemini API error' }));
              return;
            }

            const candidate = geminiData.candidates?.[0];
            if (!candidate?.content?.parts) {
              reply = 'No pude generar una respuesta.';
              break;
            }

            const parts = candidate.content.parts;

            // Check if Gemini wants to call a function
            const functionCall = parts.find((p: any) => p.functionCall);

            if (functionCall) {
              const fc = functionCall.functionCall;
              console.log(`[AI Copilot] Function call: ${fc.name}`, fc.args);

              // Execute the function
              const result = await executeFunction(
                fc.name, fc.args, financialContext, SUPABASE_URL, SUPABASE_KEY, parsed.accessToken
              );

              actionResult = { function: fc.name, args: fc.args, result };

              // Add the model's response and function result to conversation
              contents.push({ role: 'model', parts });
              contents.push({
                role: 'user',
                parts: [{
                  functionResponse: {
                    name: fc.name,
                    response: { result },
                  },
                }],
              });

              // Continue the loop — Gemini will now respond with text
              continue;
            }

            // No function call — extract text reply
            const textPart = parts.find((p: any) => p.text);
            reply = textPart?.text || 'No pude generar una respuesta.';
            break;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply, action: actionResult }));
        } catch (err: any) {
          console.error('AI Copilot error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });
    },
  };
}

// Execute a function called by Gemini
async function executeFunction(
  name: string,
  args: any,
  context: any,
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string
): Promise<any> {
  if (name === 'register_transaction') {
    return await registerTransaction(args, context, supabaseUrl, supabaseKey, accessToken);
  }
  if (name === 'update_transaction') {
    return await updateTransaction(args, context, supabaseUrl, supabaseKey, accessToken);
  }
  if (name === 'delete_transaction') {
    return await deleteTransaction(args, supabaseUrl, supabaseKey, accessToken);
  }
  return { error: `Unknown function: ${name}` };
}

async function registerTransaction(
  args: {
    description: string;
    amount: number;
    type: 'expense' | 'income';
    account_name: string;
    category_name: string;
    transaction_date: string;
  },
  context: any,
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string
) {
  // Resolve account_name → account_id
  const account = context.accounts.find(
    (a: any) => a.name.toLowerCase().includes(args.account_name.toLowerCase())
      || args.account_name.toLowerCase().includes(a.name.toLowerCase())
  );

  if (!account) {
    return {
      success: false,
      error: `No encontré la cuenta "${args.account_name}". Cuentas disponibles: ${context.accounts.map((a: any) => a.name).join(', ')}`,
    };
  }

  // Resolve category_name → category_id
  const category = context._rawCategories?.find(
    (c: any) => c.name.toLowerCase().includes(args.category_name.toLowerCase())
      || args.category_name.toLowerCase().includes(c.name.toLowerCase())
  );

  if (!category) {
    return {
      success: false,
      error: `No encontré la categoría "${args.category_name}". Categorías disponibles: ${context._rawCategories?.map((c: any) => c.name).join(', ')}`,
    };
  }

  // Determine final amount (expenses stored as negative)
  const finalAmount = args.type === 'expense' ? -Math.abs(args.amount) : Math.abs(args.amount);

  // Get user ID from JWT
  const userPayload = JSON.parse(atob(accessToken.split('.')[1]));
  const userId = userPayload.sub;

  // Insert transaction
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      description: args.description,
      amount: finalAmount,
      type: args.type,
      account_id: account.id,
      category: category.name,
      category_id: category.id,
      transaction_date: args.transaction_date,
      is_projected: false,
      is_recurring: false,
      is_transfer: false,
    }),
  });

  const insertData = await insertRes.json();

  if (!insertRes.ok) {
    return {
      success: false,
      error: `Error al insertar: ${JSON.stringify(insertData)}`,
    };
  }

  const insertedId = Array.isArray(insertData) ? insertData[0]?.id : insertData?.id;

  return {
    success: true,
    message: `Transacción registrada exitosamente`,
    transaction_id: insertedId,
    details: {
      description: args.description,
      amount: `$${Math.abs(args.amount).toLocaleString('es-MX')}`,
      type: args.type === 'expense' ? 'Gasto' : 'Ingreso',
      account: account.name,
      category: category.name,
      date: args.transaction_date,
    },
  };
}

async function updateTransaction(
  args: { transaction_id: string; description?: string; amount?: number; type?: string; account_name?: string; category_name?: string; transaction_date?: string },
  context: any,
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string
) {
  const updates: Record<string, any> = {};

  if (args.description) updates.description = args.description;
  if (args.transaction_date) updates.transaction_date = args.transaction_date;
  if (args.type) updates.type = args.type;

  if (args.amount) {
    const type = args.type || 'expense';
    updates.amount = type === 'expense' ? -Math.abs(args.amount) : Math.abs(args.amount);
  }

  if (args.account_name) {
    const account = context.accounts.find(
      (a: any) => a.name.toLowerCase().includes(args.account_name!.toLowerCase())
        || args.account_name!.toLowerCase().includes(a.name.toLowerCase())
    );
    if (!account) {
      return { success: false, error: `No encontré la cuenta "${args.account_name}"` };
    }
    updates.account_id = account.id;
  }

  if (args.category_name) {
    const category = context._rawCategories?.find(
      (c: any) => c.name.toLowerCase().includes(args.category_name!.toLowerCase())
        || args.category_name!.toLowerCase().includes(c.name.toLowerCase())
    );
    if (!category) {
      return { success: false, error: `No encontré la categoría "${args.category_name}"` };
    }
    updates.category = category.name;
    updates.category_id = category.id;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No se especificaron campos para actualizar' };
  }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/transactions?id=eq.${args.transaction_id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(updates),
    }
  );

  const updateData = await updateRes.json();

  if (!updateRes.ok) {
    return { success: false, error: `Error al actualizar: ${JSON.stringify(updateData)}` };
  }

  return {
    success: true,
    message: 'Transacción actualizada exitosamente',
    updated_fields: Object.keys(updates),
  };
}

async function deleteTransaction(
  args: { transaction_id: string; reason?: string },
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string
) {
  // Hard delete (RLS policy allows DELETE for own rows)
  const deleteRes = await fetch(
    `${supabaseUrl}/rest/v1/transactions?id=eq.${args.transaction_id}`,
    {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!deleteRes.ok) {
    const deleteData = await deleteRes.json().catch(() => ({}));
    return { success: false, error: `Error al eliminar: ${JSON.stringify(deleteData)}` };
  }

  return {
    success: true,
    message: 'Transacción eliminada exitosamente',
  };
}

async function fetchSupabase(url: string, key: string, token: string, table: string, params = '') {
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

async function buildFinancialContext(supabaseUrl: string, supabaseKey: string, accessToken: string) {
  // Calculate today in Mexico City timezone for filtering
  const mxNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const todayMx = `${mxNow.getFullYear()}-${String(mxNow.getMonth() + 1).padStart(2, '0')}-${String(mxNow.getDate()).padStart(2, '0')}`;

  const [accounts, transactions, categories, fixedExpenses, creditPurchases, budgets] =
    await Promise.all([
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'accounts', 'select=id,name,type,balance,credit_limit,is_active,cut_off_day,payment_due_day&is_active=eq.true&order=name'),
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'transactions', `select=id,description,amount,type,transaction_date,category,account_id,is_transfer,is_projected&deleted_at=is.null&transaction_date=lte.${todayMx}&order=transaction_date.desc&limit=200`),
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'categories', 'select=id,name,type&deleted_at=is.null'),
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'fixed_expenses', 'select=id,name,amount,frequency,due_day,account_id,is_active&is_active=eq.true&deleted_at=is.null'),
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'credit_purchases', 'select=id,description,total_amount,installments,installment_amount,remaining_installments,first_payment_date,account_id,is_active&is_active=eq.true'),
      fetchSupabase(supabaseUrl, supabaseKey, accessToken, 'category_budgets', 'select=id,category_id,amount'),
    ]);

  // Ensure all data is arrays (Supabase may return error objects)
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeFixed = Array.isArray(fixedExpenses) ? fixedExpenses : [];
  const safeCredit = Array.isArray(creditPurchases) ? creditPurchases : [];
  const safeBudgets = Array.isArray(budgets) ? budgets : [];

  if (!Array.isArray(accounts)) console.error('[AI Copilot] accounts not an array:', accounts);
  if (!Array.isArray(transactions)) console.error('[AI Copilot] transactions not an array:', transactions);

  const accountMap = new Map<string, string>();
  safeAccounts.forEach((a: any) => accountMap.set(a.id, a.name));

  // Use Mexico City timezone (UTC-6) for all date calculations
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyExpenses = safeTransactions
    .filter((t: any) => t.type === 'expense' && !t.is_transfer && t.transaction_date?.startsWith(thisMonth))
    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
  const monthlyIncome = safeTransactions
    .filter((t: any) => t.type === 'income' && !t.is_transfer && t.transaction_date?.startsWith(thisMonth))
    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

  const catSpending: Record<string, number> = {};
  safeTransactions
    .filter((t: any) => t.type === 'expense' && !t.is_transfer && t.transaction_date?.startsWith(thisMonth))
    .forEach((t: any) => {
      const cat = t.category || 'Sin Categoría';
      catSpending[cat] = (catSpending[cat] || 0) + Math.abs(Number(t.amount));
    });

  const totalBalance = safeAccounts
    .filter((a: any) => a.type === 'debit' || a.type === 'savings' || a.type === 'investment')
    .reduce((sum: number, a: any) => sum + Number(a.balance), 0);
  const totalDebt = safeAccounts
    .filter((a: any) => a.type === 'credit')
    .reduce((sum: number, a: any) => sum + Number(a.balance), 0);

  return {
    accounts: safeAccounts.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      credit_limit: a.credit_limit ? Number(a.credit_limit) : null,
      cut_off_day: a.cut_off_day,
      payment_due_day: a.payment_due_day,
    })),
    _rawCategories: safeCategories,
    totalBalance,
    totalDebt,
    monthlyExpenses,
    monthlyIncome,
    currentMonth: thisMonth,
    topCategoriesThisMonth: Object.entries(catSpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, amount]) => ({ name, amount })),
    subscriptions: safeFixed.map((f: any) => ({
      name: f.name,
      amount: Number(f.amount),
      frequency: f.frequency,
      due_day: f.due_day,
      account: accountMap.get(f.account_id) || 'Unknown',
    })),
    creditPurchases: safeCredit.map((c: any) => ({
      description: c.description,
      total: Number(c.total_amount),
      installment: Number(c.installment_amount),
      remaining: c.remaining_installments,
      total_installments: c.installments,
      account: accountMap.get(c.account_id) || 'Unknown',
    })),
    budgets: safeBudgets.map((b: any) => {
      const cat = safeCategories.find((c: any) => c.id === b.category_id);
      return {
        category: cat?.name || 'Unknown',
        limit: Number(b.amount),
        spent: catSpending[cat?.name || ''] || 0,
      };
    }),
    recentTransactions: safeTransactions.slice(0, 30).map((t: any) => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      date: t.transaction_date,
      category: t.category,
      account: accountMap.get(t.account_id) || 'Unknown',
    })),
  };
}

function buildSystemPrompt(ctx: any) {
  // Use Mexico City timezone for "today"
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `Eres el Asistente Financiero IA de FinanzasApp. Respondes en español mexicano de forma clara, directa y profesional.
Zona horaria del usuario: América/Ciudad de México (CST, UTC-6). HOY es ${today}.

CAPACIDADES:
1. Responder preguntas sobre las finanzas del usuario con datos reales
2. REGISTRAR transacciones nuevas (register_transaction)
3. MODIFICAR transacciones existentes (update_transaction)
4. ELIMINAR transacciones (delete_transaction)

REGLAS CRÍTICAS PARA GESTIÓN DE TRANSACCIONES:

⚠️ REGLA MÁS IMPORTANTE: NUNCA crees una nueva transacción para corregir una existente.
- Si el usuario dice "fue ayer" o "cambia la fecha" → usa update_transaction con el ID de la transacción
- Si el usuario dice "borra eso" o "esa no va" → usa delete_transaction
- Si acabas de registrar algo y el usuario quiere corregirlo, usa el transaction_id que devolvió register_transaction
- SOLO usa register_transaction para movimientos NUEVOS que no existían antes

REGLAS PARA REGISTRAR GASTOS NUEVOS:
- Cuando el usuario diga algo como "gasté X en Y", debes registrarlo
- Si te faltan datos, pregunta ANTES de llamar la función. Datos necesarios:
  • Monto (obligatorio)
  • Descripción (obligatorio) 
  • Cuenta/tarjeta (obligatorio) — pregunta con las opciones reales del usuario
  • Categoría (obligatorio) — sugiere la más apropiada de las categorías existentes
  • Fecha (si no dice, asume hoy: ${today})
  • Tipo: gasto o ingreso (inferir del contexto)
- SIEMPRE muestra un resumen de confirmación DESPUÉS de registrar
- Recuerda el transaction_id que devuelve register_transaction en caso de que el usuario quiera corregir

REGLAS PARA BUSCAR TRANSACCIONES:
- El usuario puede referirse a una transacción por su DESCRIPCIÓN (ej: "Walmart", "Gasolina", "Tacos") o por su CATEGORÍA (ej: "Despensa", "Transporte")
- La columna "description" contiene el nombre del establecimiento o concepto (ej: "Walmart", "Amazon", "Starbucks")
- La columna "category" contiene la clasificación general (ej: "Despensa", "Ropa", "Tecnología")
- SIEMPRE busca primero por el campo 'description' (coincidencia parcial, sin importar mayúsculas/minúsculas)
- Si NO encuentras coincidencia en 'description', entonces busca en 'category'
- Si el usuario dice "la de Walmart" busca en description que contenga "Walmart"

REGLAS PARA MODIFICAR TRANSACCIONES:
- Usa update_transaction cuando el usuario quiera cambiar cualquier dato de una transacción existente
- Solo envía los campos que cambian
- Necesitas el transaction_id — búscalo en las transacciones recientes del contexto o usa el que devolvió register_transaction

CUENTAS DEL USUARIO:
${ctx.accounts.map((a: any) => `• ${a.name} (${a.type}) — ID: ${a.id}`).join('\n')}

CATEGORÍAS DISPONIBLES:
${ctx._rawCategories.map((c: any) => `• ${c.name} (${c.type})`).join('\n')}

CONTEXTO FINANCIERO (datos reales al ${today}):

═══ RESUMEN ═══
• Balance total (débito/ahorro/inversión): $${ctx.totalBalance.toLocaleString('es-MX')}
• Deuda total en TDC: $${ctx.totalDebt.toLocaleString('es-MX')}
• Gastos del mes (${ctx.currentMonth}): $${ctx.monthlyExpenses.toLocaleString('es-MX')}
• Ingresos del mes: $${ctx.monthlyIncome.toLocaleString('es-MX')}

═══ CUENTAS ═══
${ctx.accounts.map((a: any) => `• ${a.name} (${a.type}): $${a.balance.toLocaleString('es-MX')}${a.credit_limit ? ` / Límite: $${a.credit_limit.toLocaleString('es-MX')}` : ''}${a.cut_off_day ? ` | Corte: día ${a.cut_off_day}, Pago: día ${a.payment_due_day}` : ''}`).join('\n')}

═══ TOP GASTOS DEL MES ═══
${ctx.topCategoriesThisMonth.map((c: any, i: number) => `${i + 1}. ${c.name}: $${c.amount.toLocaleString('es-MX')}`).join('\n')}

═══ SUSCRIPCIONES ACTIVAS ═══
${ctx.subscriptions.map((s: any) => `• ${s.name}: $${s.amount.toLocaleString('es-MX')}/${s.frequency} (día ${s.due_day}, ${s.account})`).join('\n')}

═══ COMPRAS A MESES (MSI) ═══
${ctx.creditPurchases.map((c: any) => `• ${c.description}: $${c.installment.toLocaleString('es-MX')}/mes (${c.remaining}/${c.total_installments} cuotas restantes, ${c.account})`).join('\n')}

═══ PRESUPUESTOS ═══
${ctx.budgets.map((b: any) => `• ${b.category}: $${b.spent.toLocaleString('es-MX')} / $${b.limit.toLocaleString('es-MX')} (${b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0}%)`).join('\n')}

═══ TRANSACCIONES RECIENTES (con ID para modificar/eliminar) ═══
${ctx.recentTransactions.slice(0, 15).map((t: any) => `• [ID:${t.id}] ${t.date} | ${t.description} | $${t.amount.toLocaleString('es-MX')} | ${t.category || 'Sin cat.'} | ${t.account}`).join('\n')}

REGLAS GENERALES:
1. Usa los datos reales del usuario para responder. No inventes cifras.
2. Formatea montos como $X,XXX.XX (pesos mexicanos).
3. Sé conciso pero completo. Usa bullets y formato claro.
4. Si detectas problemas (presupuesto excedido, deuda alta), menciónalo proactivamente.
5. Responde como un asesor financiero amigable pero profesional.
6. Usa emojis con moderación (💰, 📊, ⚠️, ✅, etc.)
7. NUNCA muestres los IDs de transacciones al usuario. Son para uso interno.`;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), geminiProxyPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
