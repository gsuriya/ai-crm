# Connect Framer Button to Localhost (Testing)

## Quick Setup

1. **Make sure your dev server is running**:
   ```bash
   npm run dev
   ```
   Your app should be at: `http://localhost:3000`

2. **In Framer, select your "Download for Mac" button**

3. **In the Properties Panel (right sidebar), find "Link" section**

4. **Enter this URL**:
   ```
   http://localhost:3000/auth/signin
   ```
   Or just:
   ```
   http://localhost:3000
   ```
   (will auto-redirect to sign-in if not authenticated)

5. **Test it**:
   - Click "Preview" in Framer
   - Click your button
   - Should open `http://localhost:3000/auth/signin`

---

## Note for Testing

When testing locally:
- The Framer preview will open in your browser
- Clicking the button should redirect to `localhost:3000`
- Make sure your dev server is running (`npm run dev`)
- OAuth will work because Google Cloud Console already has `http://localhost:3000/auth/callback` configured

---

## When You're Ready to Deploy

Once you deploy to Vercel, just update the button link to:
- `https://YOUR_VERCEL_URL/auth/signin`

Same process, just different URL!







