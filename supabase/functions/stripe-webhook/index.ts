// Stripe webhook: marks an order paid once Checkout completes.
// Deploy with verify_jwt = false (Stripe calls this without a Supabase JWT);
// security comes from verifying the Stripe signature instead.
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Webhook verification failed: ${(e as Error).message}`, { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === 'paid') {
      await admin.from('orders').update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      }).eq('id', orderId);
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (userId) {
      const active = sub.status === 'active' || sub.status === 'trialing';
      await admin.from('profiles').update({
        subscription_status: sub.status,
        subscription_tier: active ? (sub.metadata?.tier ?? null) : null,
        stripe_subscription_id: sub.id,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscription_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (userId) {
      await admin.from('profiles').update({ subscription_status: 'canceled', subscription_tier: null }).eq('id', userId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
