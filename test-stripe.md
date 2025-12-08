# Stripe Integration Test Guide

## ✅ Setup Complete!

Your Stripe integration is ready to test. Here's what's configured:

### Webhook Status
- ✅ Webhook listener is running in background
- ✅ Forwarding to: `localhost:3000/api/stripe/webhook`
- ✅ Webhook secret: `whsec_9c2089330f1dbaf11d2c9ab6a09b51ba60df54dc1707e5ff3f11af041dc344f2`

### Test the Payment Flow

1. **Go to upgrade page:**
   ```
   http://localhost:3000/upgrade
   ```

2. **Click "Upgrade Now" button**

3. **Use Stripe test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)

4. **Complete payment**
   - Should redirect to success page
   - Webhook will fire and update your subscription
   - Check logs: `tail -f stripe-webhook.log`

5. **Verify subscription:**
   - Sidebar should show "Paid Plan" under your profile
   - Usage section should show "✨ Unlimited"

### Check Webhook Logs
```bash
tail -f /Users/gsuriya/Downloads/ai-crm-most-updated/stripe-webhook.log
```

### Stop Webhook Listener
```bash
pkill -f "stripe listen"
```

### Restart Webhook Listener
```bash
cd /Users/gsuriya/Downloads/ai-crm-most-updated
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Database Tables Created

1. **user_subscriptions** - Tracks paid plans
2. **company_email_formats** - Caches email patterns

## Pricing

- **Free Plan:** 5 people max per month
- **Paid Plan:** $20/month - UNLIMITED everything

