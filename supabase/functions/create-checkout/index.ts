// Creates a Stripe Checkout session for an order and returns the hosted URL.
// The amount is computed server-side from the order row — never trusted from the client.
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://laundrydispatch.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    // Identify the caller from their Supabase JWT.
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: 'Missing order_id' }, 400);

    // Read the order with the service role and verify ownership + amount server-side.
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, customer_id, estimated_price, payment_status')
      .eq('id', order_id)
      .single();
    if (orderErr || !order) return json({ error: 'Order not found' }, 404);
    if (order.customer_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (order.payment_status === 'paid') return json({ error: 'Order already paid' }, 400);

    const amountCents = Math.round(Number(order.estimated_price ?? 0) * 100);
    if (amountCents < 50) return json({ error: 'Invalid order amount' }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: `Laundry Dispatch — order ${String(order.id).slice(0, 8)}` },
        },
      }],
      success_url: `${SITE_URL}/?paid=1&order=${order.id}`,
      cancel_url: `${SITE_URL}/?canceled=1&order=${order.id}`,
      metadata: { order_id: String(order.id), user_id: user.id },
    });

    await admin
      .from('orders')
      .update({ stripe_session_id: session.id, payment_status: 'processing' })
      .eq('id', order.id);

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
