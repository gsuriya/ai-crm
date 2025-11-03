# 📋 Google Sign-In & API Testing Guide

## ✅ Current Status

1. **OAuth Flow**: Working correctly ✅
   - Google sign-in page loads
   - Account recognized: `sg.suriya.v@gmail.com`
   - Sign-in options displayed

2. **Next Steps**:
   - Complete Google authentication (enter password or use passkey)
   - After sign-in, you'll be redirected back to the app
   - Then test the APIs!

## 🧪 Testing the APIs

Once you're signed in:

1. **Go to Test Page**: `http://localhost:3000/test-real`
2. **Click "🚀 Run All API Tests"**
3. **What will happen**:
   - 📧 **Gmail**: Sends email to `sg.suriya.v@gmail.com`
   - 📅 **Calendar**: Sends calendar invite to `sg.suriya.v@gmail.com`
   - 📞 **VAPI**: Calls `+1 (925) 577-2134`

## 🔍 Manual Testing

You can also test individual APIs:

### Test Gmail API
```bash
# After signing in, this will work (requires auth session)
curl http://localhost:3000/api/test -X POST \
  -H "Content-Type: application/json" \
  -d '{"test_type": "gmail"}'
```

### Test Calendar API
```bash
curl http://localhost:3000/api/test -X POST \
  -H "Content-Type: application/json" \
  -d '{"test_type": "calendar"}'
```

### Test VAPI (doesn't require Google auth)
```bash
curl http://localhost:3000/api/test -X POST \
  -H "Content-Type: application/json" \
  -d '{"test_type": "vapi"}'
```

## ✅ What's Already Working

- ✅ VAPI API: Already tested and working (call ID: `019a4239-22af-777d-99a3-10fda9d88917`)
- ✅ Google OAuth: Configured and redirecting correctly
- ✅ OAuth Scopes: Gmail.send, Calendar.events, userinfo

## 🎯 Complete Sign-In Flow

1. Complete Google sign-in (enter password)
2. Grant permissions for Gmail and Calendar
3. You'll be redirected to `/auth/callback`
4. Then redirected to `/companies` or the app
5. Your OAuth tokens will be stored in Supabase
6. Now you can test the APIs!

---

**Ready to test?** Complete the Google sign-in and then visit `http://localhost:3000/test-real` 🚀

