# Background Processor Not Running - Quick Fix

## Problem
The cadence delay block schedules correctly, but the background processor (`/api/cadence/process`) isn't running automatically, so scheduled executions never execute.

## Solution: Manual Trigger (For Now)

**Option 1: Call the API manually**
```bash
curl -X POST http://localhost:3000/api/cadence/process
```

**Option 2: Visit this URL in browser**
```
http://localhost:3000/api/cadence/process
```

**Option 3: Add automatic processing**

The background processor runs automatically when you're on a company detail page (every 10 seconds), but if you're not on that page, it won't run.

## Permanent Fix: Set Up Automatic Processing

You need to set up a cron job or scheduled task to call `/api/cadence/process` every minute.

### Option A: Use a cron service (Recommended for production)
- Use a service like EasyCron, cron-job.org, or similar
- Set it to call `https://your-domain.com/api/cadence/process` every minute

### Option B: Add a background worker in your app
Create a page that auto-refreshes and calls the processor:
```typescript
// app/api/cadence/auto-process/route.ts
// This runs every time the page loads
```

### Option C: Use Vercel Cron (if deployed on Vercel)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cadence/process",
    "schedule": "*/1 * * * *"
  }]
}
```

## Testing Right Now

1. **Manually trigger the processor**:
   ```bash
   curl -X POST http://localhost:3000/api/cadence/process
   ```

2. **Check if it processed**:
   ```bash
   curl http://localhost:3000/api/cadence/process
   ```

3. **If it says "processed: 1"**, the second email should have been sent!

## Next Steps

After manually triggering, your second email should send. But for production, you need to set up automatic processing.

