# How to Report a Missing Item on SkinVaults

This guide will walk you through the process of reporting an item that is missing or has issues on SkinVaults.

## Step-by-Step Guide

### Step 1: Navigate to an Item Page

1. Go to the SkinVaults website: `https://skinvaults.online`
2. Search for an item using the search bar, or browse through the market
3. Click on any item to open its detail page

**Note:** You can also report items that don't exist on the site yet. In that case, you'll need to use the item ID or name from Steam.

---

### Step 2: Find the Report Button

The report button is available in two locations:

#### **Desktop View:**
- Look at the top-right of the item detail page
- You'll see several buttons: Share, Compare, **Report**, Tracker, and Wishlist
- The **Report** button has a yellow warning triangle icon (⚠️) with "Report" text

#### **Mobile View:**
- Look at the bottom-right corner of the item image card
- You'll see a yellow circular button with a warning triangle icon (⚠️)
- This is the mobile report button

---

### Step 3: Click the Report Button

1. Click the **Report** button (desktop) or the yellow warning icon (mobile)
2. A modal window will open with the report form

---

### Step 4: Fill Out the Report Form

The report form has the following fields:

#### **Item Name** (Required)
- This field is pre-filled with the current item's name
- If reporting a missing item, enter the full item name (e.g., "AK-47 | Redline (Field-Tested)")
- Example: `AK-47 | Redline (Field-Tested)`

#### **Item ID** (Optional but Recommended)
- This field is pre-filled if you're on an existing item page
- For missing items, enter the item ID if you know it
- Example: `skin-ak47-redline-ft` or `skin-ad56dc47a4c4_1_st`
- You can find this in the URL when viewing an item on Steam Market

#### **Item Image URL** (Optional)
- Enter a direct URL to the item's image
- This helps admins identify the item more easily
- Example: `https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9Y3zjxq3r0E4Y2n3d4fBd1M3Y1zV-lK_xu3s1sW5tJ7Nn3Rl6MqDmQ`

#### **Reason for Report** (Required)
- Describe why you're reporting this item
- Be as specific as possible
- Examples:
  - "This item is not showing up in search results"
  - "The price data is incorrect"
  - "The item image is missing or broken"
  - "This item exists on Steam but not on SkinVaults"
  - "The item details are incorrect"

---

### Step 5: Submit the Report

1. Review all the information you've entered
2. Click the **"Submit Report"** button (yellow button at the bottom)
3. Wait for the submission to complete (you'll see a loading spinner)

---

### Step 6: Confirmation

After successful submission:

1. You'll see a success message: **"Report Submitted!"**
2. A confirmation message will appear: "Thank you for your contribution. We will review your report shortly."
3. Click **"Close"** to dismiss the modal
4. Your report has been sent to the admin team via Discord webhook

---

## What Happens After You Submit?

1. **Automatic Check**: The system automatically checks if the item exists in the CS2 API
2. **Discord Notification**: Admins receive a notification in Discord with all your report details
3. **Database Storage**: Your report is saved in the database for admin review
4. **Admin Review**: Admins will review your report and take appropriate action:
   - If the item is missing: They can add it as a custom item
   - If there's an issue: They can fix the problem
   - If it's a duplicate: They can resolve or dismiss the report

---

## Tips for Better Reports

✅ **Do:**
- Provide as much detail as possible in the "Reason" field
- Include the item ID if you know it (helps with faster processing)
- Use the exact item name from Steam Market
- Include an image URL if available

❌ **Don't:**
- Submit duplicate reports for the same item
- Report items that are clearly working correctly
- Use vague descriptions like "it's broken" without details

---

## Finding Item Information

If you need to find item details for a missing item:

1. **Steam Market**: Go to `https://steamcommunity.com/market/`
2. Search for the item
3. Copy the exact name from the listing
4. The item ID is usually in the URL or item details

---

## Troubleshooting

### "Report button not showing"
- Make sure you're on an item detail page (`/item/[id]`)
- Try refreshing the page
- Check if you're using an ad blocker that might hide the button

### "Form won't submit"
- Make sure all required fields are filled (Item Name and Reason)
- Check your internet connection
- Try again after a few seconds

### "No confirmation message"
- Check your browser console for errors
- Make sure JavaScript is enabled
- Try submitting again

---

## Need Help?

If you encounter any issues or have questions:
- Contact us through the Contact page
- Join our Discord server
- Check the FAQ page for more information

---

**Thank you for helping improve SkinVaults!** 🎮✨

