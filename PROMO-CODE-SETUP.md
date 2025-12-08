# ✅ Stripe Setup Complete!

## Changes Made:

1. **Sidebar now shows:**
   - Free Plan: "5/5 cadence adds left"
   - Paid Plan: "✨ Unlimited cadence adds"

2. **Promo codes enabled in checkout**
   - Users can now enter promo codes during checkout

## Create Test Promo Code (100% Off):

Go to Stripe Dashboard and create a promo code:

1. **Go to:** https://dashboard.stripe.com/test/coupons
2. **Click "New" button**
3. **Create coupon:**
   - Name: "Test - 100% Off"
   - Discount: 100% off
   - Duration: Forever
4. **Click "Create coupon"**
5. **Then create promotion code:**
   - Click "Create promotion code"
   - Code: `TEST100`
   - Click "Create"

## OR Use This Coupon ID:

I already created a 100% off coupon for you:
- **Coupon ID:** `RsLhsYxY`

Just create a promotion code in the dashboard:
1. Go to: https://dashboard.stripe.com/test/coupons/RsLhsYxY
2. Click "Create promotion code"
3. Enter code: `TEST100`
4. Click "Create"

## Test the Checkout:

1. Go to `/upgrade`
2. Click "Upgrade Now"
3. In the checkout form, click "Add promotion code"
4. Enter: `TEST100`
5. Price should drop to $0.00
6. Complete checkout with test card: `4242 4242 4242 4242`

Done! 🎉
