# Delay Block Bug Fix

## 🐛 Bug Description

When chaining 2 email blocks with a delay block between them, emails were being sent at seemingly random times (way before or after the set wait time).

## 🔍 Root Cause

The bug was in `lib/services/cadence-execution.ts` in the delay block handling:

1. **Inline Wait (Line 508-511)**: The delay block was waiting inline using `await new Promise(resolve => setTimeout(resolve, totalMs))`. This is incorrect for production use.

2. **Immediate Recursive Execution (Line 567-568)**: After waiting inline, the code immediately called `executeNextBlock` recursively, which meant the next block (email) executed IMMEDIATELY, not after the scheduled delay time.

3. **Bypassing Scheduled Time**: Even though the code set `scheduled_for` to a future timestamp, it immediately executed the next block, completely bypassing the scheduled time.

## ✅ Fix Applied

### 1. Removed Inline Wait
- **Before**: Delay block waited inline using `setTimeout`
- **After**: Delay block schedules the next block and returns immediately

### 2. Removed Recursive Execution
- **Before**: Delay block recursively called `executeNextBlock` after waiting
- **After**: Delay block returns immediately, letting the background processor handle continuation

### 3. Updated Background Processor
- **Before**: Background processor didn't clear `scheduled_for` before processing
- **After**: Background processor clears `scheduled_for` before processing to prevent double-processing

## 📝 Code Changes

### `lib/services/cadence-execution.ts` (Delay Block Handler)

**Before:**
```typescript
await updateExecutionState(supabase, execution.id, {
  current_block_id: nextBlockId,
  scheduled_for: scheduledFor,
  metadata: preservedMetadata,
});

// Wait inline (like sourcing does)
await new Promise(resolve => setTimeout(resolve, totalMs));

// After delay, restore captured metadata and continue
const executionAfterDelay = await getExecution(supabase, execution.id);
// ... restore metadata ...
await executeNextBlock(supabase, finalExecution, blocks);
return;
```

**After:**
```typescript
await updateExecutionState(supabase, execution.id, {
  current_block_id: nextBlockId,
  scheduled_for: scheduledFor,
  metadata: preservedMetadata,
});

console.log(`[Workflow] ⏳ Scheduled next block (${nextBlockId}) for ${scheduledFor.toISOString()}`);
console.log(`[Workflow] ⏸️ Delay block complete - execution will resume when background processor picks up scheduled execution`);

// CRITICAL: Do NOT wait inline or recursively execute next block
// The background processor (/api/cadence/process) will pick up this execution
// when scheduled_for <= now and execute the next block
// This ensures delays are properly respected and not executed immediately
return; // Return immediately - background processor will handle continuation
```

### `app/api/cadence/process/route.ts` (Background Processor)

**Before:**
```typescript
for (const execution of executions) {
  try {
    // Get cadence to retrieve blocks
    // ...
    await executeNextBlock(supabase, execution, blocks);
```

**After:**
```typescript
for (const execution of executions) {
  try {
    // Clear scheduled_for to prevent double-processing
    await updateExecutionState(supabase, execution.id, {
      scheduled_for: null,
    });

    // Get cadence to retrieve blocks
    // ...
    
    // Get fresh execution with cleared scheduled_for
    const freshExecution = await getExecution(supabase, execution.id);
    await executeNextBlock(supabase, freshExecution, blocks);
```

## 🔄 How It Works Now

1. **Delay Block Execution**:
   - Calculates scheduled time (`scheduledFor = Date.now() + delayMs`)
   - Updates execution state with:
     - `current_block_id` = next block ID (after delay)
     - `scheduled_for` = future timestamp
     - `metadata` = preserved threadInfoMap and executedBlockIds
   - Returns immediately (no inline wait, no recursive execution)

2. **Background Processor** (`/api/cadence/process`):
   - Queries for executions where `scheduled_for <= now`
   - Clears `scheduled_for` to prevent double-processing
   - Executes the next block (which is already set in `current_block_id`)
   - The metadata (threadInfoMap) is preserved in the database, so email blocks can access thread info

3. **Email Block Execution**:
   - Loads threadInfoMap from execution metadata
   - Uses thread info to reply to previous emails correctly
   - Saves new thread info back to metadata

## ✅ Expected Behavior

- **Email 1** → Sends immediately
- **Delay Block** → Schedules Email 2 for future time (e.g., 3 days later)
- **Background Processor** → Picks up scheduled execution when `scheduled_for <= now`
- **Email 2** → Sends at the correct time (after delay), with proper thread info

## 🧪 Testing

To test the fix:

1. Create a cadence with:
   - Email Block 1 (initial email)
   - Delay Block (set to 1 minute for testing)
   - Email Block 2 (follow-up email, reply to previous)

2. Start the cadence for a company

3. **Expected**:
   - Email 1 should send immediately
   - Email 2 should send after 1 minute (or whatever delay you set)
   - Email 2 should properly reply to Email 1's thread

4. **Monitor**:
   - Check `cadence_executions` table: `scheduled_for` should be set correctly
   - Check `/api/cadence/process` GET endpoint to see scheduled executions
   - Verify emails are sent at the correct times

## 📋 Notes

- The background processor (`/api/cadence/process`) needs to be called regularly (e.g., via cron job or scheduled task)
- For production, you should set up a cron job to call `/api/cadence/process` every minute (or as needed)
- The metadata (threadInfoMap) is preserved across delays, so email threading works correctly

