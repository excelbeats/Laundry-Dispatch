// Creates a Stripe Checkout session in subscription mode for a membership tier.
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://laundrydispatch.com';

const PRICES: Record<string, string> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC') ?? '',
  plus: Deno.env.get('STRIPE_PRICE_PLUS') ?? '',
  family: Deno.env.get('STRIPE_PRICE_FAMILY') ?? '',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { tier } = await req.json().catch(() => ({}));
    const priceId = PRICES[String(tier)];
    if (!priceId) return json({ error: 'Invalid membership tier' }, 400);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, name, subscription_status')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
      return json({ error: 'You already have an active membership' }, 400);
    }

    // reuse or create the Stripe customer for this user
    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile?.name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/?subscribed=1`,
      cancel_url: `${SITE_URL}/?subscribe_canceled=1`,
      metadata: { user_id: user.id, tier: String(tier) },
      subscription_data: { metadata: { user_id: user.id, tier: String(tier) } },
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
