# Fix Purchase Feature - Admin Guide

## What is "Fix Purchase"?

The **Fix Purchase** feature is a manual tool in the admin panel that allows you to manually fulfill purchases that weren't automatically granted. This is a safety net for when the automatic payment fulfillment system fails.

---

## When Should You Use It?

Use the **Fix Purchase** feature in these situations:

### 1. **Stripe Webhook Failed**
- The payment was successful in Stripe, but the webhook didn't fire or failed
- User paid but didn't receive their Pro subscription or consumable
- Check Stripe dashboard → Webhooks → Events to see if webhook failed

### 2. **User Reports Missing Rewards**
- User says: "I paid but didn't get my Pro/consumable"
- Payment shows as completed in Stripe
- User can provide their Steam ID or payment session ID

### 3. **Database/Network Issues**
- Temporary KV (database) connection issues during payment
- Network timeout during webhook processing
- Server errors during automatic fulfillment

### 4. **Test Mode Issues**
- Testing payments in test mode and webhook didn't work
- Manually verifying test purchases

### 5. **Edge Cases**
- Payment succeeded but fulfillment logic had a bug
- Race conditions where webhook processed before payment completed
- Data corruption or partial fulfillment

---

## How It Works

### Step-by-Step Process:

1. **Enter Steam ID**
   - User provides their Steam ID64 (17 digits, starts with 7656119...)
   - Enter it in the "SteamID64" field

2. **Load Purchases**
   - Click "Load Purchases" button
   - System fetches all purchases for that user from `purchase_history` in KV
   - Shows a table with all purchases

3. **Review Purchase Status**
   - Each purchase shows:
     - **Date**: When the purchase was made
     - **Type**: Pro subscription or Consumable (e.g., Discord Access)
     - **Amount**: Payment amount
     - **Status**: ✅ Fulfilled or ❌ Failed
     - **Actions**: "Fix" button (only shown for failed purchases)

4. **Fix Failed Purchases**
   - Click the "Fix" button next to any purchase marked as ❌ Failed
   - System will:
     - Verify the payment with Stripe (checks if payment was actually completed)
     - Verify Steam ID matches
     - Grant the reward (Pro subscription or consumable)
     - Mark purchase as fulfilled in purchase history
     - Update user's rewards in KV

5. **Confirmation**
   - Success message appears
   - Purchase status updates to ✅ Fulfilled
   - User should now have their reward

---

## Technical Details

### What Happens Behind the Scenes:

1. **Stripe Verification**
   ```typescript
   // Retrieves the checkout session from Stripe
   const session = await stripe.checkout.sessions.retrieve(sessionId);
   
   // Verifies payment was actually completed
   if (session.payment_status !== 'paid') {
     return error; // Payment not completed
   }
   ```

2. **Steam ID Verification**
   ```typescript
   // Ensures the Steam ID matches the payment
   if (session.metadata?.steamId !== steamId) {
     return error; // Steam ID mismatch
   }
   ```

3. **Reward Granting**
   - **For Pro Subscriptions**: Grants Pro months using `grantPro()`
   - **For Consumables**: Adds reward to `user_rewards` KV key
   - **For Discord Access**: Grants `discord_access` reward (gives 3 price trackers)

4. **Purchase History Update**
   ```typescript
   purchase.fulfilled = true;
   purchase.fulfilledAt = new Date().toISOString();
   ```

---

## Common Scenarios

### Scenario 1: User Bought Pro But Didn't Get It
1. User reports: "I paid €9.99 but I'm still not Pro"
2. Check Stripe dashboard → Payments → Find the payment
3. Get user's Steam ID from their profile
4. Use Fix Purchase:
   - Enter Steam ID
   - Load Purchases
   - Find the Pro purchase with ❌ Failed status
   - Click "Fix"
5. User should now have Pro

### Scenario 2: User Bought Discord Access But Can't Use Trackers
1. User reports: "I bought Discord Access but I can't create price trackers"
2. Get user's Steam ID
3. Use Fix Purchase:
   - Enter Steam ID
   - Load Purchases
   - Find the `discord_access` consumable with ❌ Failed status
   - Click "Fix"
4. User should now have Discord Access (3 price trackers)

### Scenario 3: Webhook Failed During High Traffic
1. Multiple users report missing rewards after payment
2. Check Stripe webhook logs → See failed webhooks
3. For each affected user:
   - Enter their Steam ID
   - Load Purchases
   - Fix any failed purchases
4. All users should now have their rewards

---

## Safety Features

### Built-in Protections:

1. **Payment Verification**
   - Only fixes purchases where payment was actually completed
   - Won't grant rewards for unpaid or failed payments

2. **Steam ID Matching**
   - Verifies Steam ID matches the payment metadata
   - Prevents granting rewards to wrong user

3. **Duplicate Prevention**
   - Checks if reward already granted before granting again
   - Won't double-grant rewards

4. **Admin Only**
   - Only accessible to site owner (checks `isOwner()`)
   - Requires admin key authentication

---

## Troubleshooting

### "Payment not completed" Error
- **Cause**: Payment wasn't actually successful in Stripe
- **Solution**: Check Stripe dashboard to verify payment status
- **Action**: Don't fix - payment needs to be completed first

### "Steam ID mismatch" Error
- **Cause**: Steam ID doesn't match the payment metadata
- **Solution**: Verify correct Steam ID with user
- **Action**: Use the Steam ID from the payment metadata

### "Purchase already fulfilled" Message
- **Cause**: Reward was already granted
- **Solution**: Check user's rewards - they should already have it
- **Action**: No action needed - purchase is already complete

### "Failed to load purchases" Error
- **Cause**: KV database connection issue
- **Solution**: Check KV connection, retry
- **Action**: Wait and retry, or check KV status

---

## Best Practices

1. **Always Verify Payment First**
   - Check Stripe dashboard before fixing
   - Ensure payment was actually completed

2. **Get Correct Steam ID**
   - Ask user for their Steam ID64 (17 digits)
   - Or find it in their profile URL

3. **Check Purchase History**
   - Review all purchases before fixing
   - Understand what the user should receive

4. **Test After Fixing**
   - Verify user can access their reward
   - Check Pro status or consumable in their account

5. **Document Issues**
   - Note why webhook failed (if known)
   - Track patterns to prevent future issues

---

## Related Features

- **Failed Purchases Section**: Shows all failed purchases across all users
- **Purchase History**: View all purchases for any user
- **Admin Panel**: Main admin interface for managing Pro users

---

## API Endpoints Used

- `GET /api/admin/purchases?steamId=...` - Load purchases for a user
- `POST /api/payment/fix-purchase` - Manually fulfill a purchase

---

## Summary

**Fix Purchase** is your safety net when automatic payment fulfillment fails. It manually verifies payments with Stripe and grants rewards that should have been granted automatically. Use it whenever a user reports they paid but didn't receive their reward.

