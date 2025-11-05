# Cadence Delay Issue - Diagnosis & Fix Summary

## 🔍 Problem Diagnosed

Your cadence ran 6+ minutes ago with:
- Email 1: "hi" ✅ Sent
- Delay: 1 minute
- Email 2: "hello hello" ❌ Never sent

## 🐛 Root Causes Found

### 1. **Background Processor Not Running Globally** ✅ FIXED
- **Issue**: Background processor only ran on company detail pages
- **Fix**: Added global background processor to `layout-wrapper.tsx` that runs on every page every 10 seconds

### 2. **Authentication Error** ✅ FIXED  
- **Issue**: Background processor failed with "User not authenticated" when no session
- **Fix**: Updated `executeNextBlock` to use stored `user_id` from metadata instead of requiring auth session

## ✅ Fixes Applied

1. **Fixed authentication** in `lib/services/cadence-execution.ts`:
   - Uses stored `user_id` from metadata when auth session is missing
   - Background processor can now run without user session

2. **Added global background processor** in `components/layout-wrapper.tsx`:
   - Runs on every page (not just company detail pages)
   - Checks every 10 seconds for scheduled executions
   - Processes them automatically

## 🔄 How It Works Now

1. **Email 1** executes → sends immediately
2. **Delay block** executes → schedules Email 2 for future time, returns
3. **Global background processor** (runs every 10 seconds on any page):
   - Checks for executions where `scheduled_for <= now`
   - Processes them automatically
4. **Email 2** executes → sends at correct time

## 🧪 Testing Your Cadence

**For your existing cadence that's stuck:**

1. **Check if it's still scheduled**: 
   - Go to: http://localhost:3000/api/cadence/process (GET)
   - This shows all scheduled executions

2. **Manually trigger processor**:
   - The global processor should pick it up automatically now
   - Or manually call: `curl -X POST http://localhost:3000/api/cadence/process`

3. **Run a new test cadence**:
   - Create: Email 1 → Delay (1 minute) → Email 2
   - Start the cadence
   - Wait 1-2 minutes
   - Email 2 should send automatically

## 📊 Expected Behavior

- **Email 1**: Sends immediately when cadence starts
- **Delay Block**: Schedules Email 2 for 1 minute later
- **Background Processor**: Picks up scheduled execution within 10 seconds
- **Email 2**: Sends ~1 minute after Email 1 (within 10-second polling window)

## ⚠️ If Still Not Working

Check:
1. Is the app open in browser? (Background processor needs browser open)
2. Check browser console for errors
3. Check server logs for execution errors
4. Verify `scheduled_for` is set correctly in database

## 🎯 Next Steps

1. **Refresh the app** - The global processor will start running
2. **Wait 10 seconds** - It should pick up your stuck execution
3. **Check your email** - Email 2 should arrive
4. **Test with a new cadence** - Should work automatically now

