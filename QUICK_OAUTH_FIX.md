# Quick OAuth Fix for ethanzzheng@gmail.com

## ⚠️ Error: "This browser or app may not be secure"

This happens because your email isn't in Google's test users list.

## ✅ Fix (2 minutes)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials/consent

2. **Click "EDIT APP"** (or configure if not set up)

3. **Go to "Test users" tab**

4. **Click "ADD USERS"**

5. **Add your email**: `ethanzzheng@gmail.com`

6. **Click "Save"**

7. **Try signing in again** - it should work now!

## 🔍 Verify Scopes

While you're there, make sure these scopes are added:
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar`

## 🔗 Verify Redirect URI

Go to: **APIs & Services** → **Credentials** → Your OAuth 2.0 Client ID

Make sure this is in **Authorized redirect URIs**:
```
http://localhost:3000/auth/google-callback
```

## ✅ After Fix

1. Restart your dev server (if needed)
2. Go to `http://localhost:3000/auth/signin`
3. Click "Continue with Google"
4. You should see the consent screen (not the security error)
5. Grant permissions
6. You're in! 🎉

