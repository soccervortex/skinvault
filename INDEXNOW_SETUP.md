# IndexNow Setup for Bing

## What is IndexNow?
IndexNow is a protocol that allows you to instantly notify search engines (Bing, Yandex, etc.) when your website content changes, so they can index your pages faster.

## Setup Complete ✅

### 1. API Key File
✅ Created: `public/99982adb45e64fb7b2e24712db654185.txt`
- This file contains your IndexNow API key: `99982adb45e64fb7b2e24712db654185`
- Accessible at: `https://skinvaults.online/99982adb45e64fb7b2e24712db654185.txt`
- This verifies ownership of your domain

### 2. API Route
✅ Created: `src/app/api/indexnow/route.ts`
- Endpoint: `/api/indexnow`
- Supports both GET and POST methods

## How to Use

### Method 1: Submit All Sitemap URLs (GET)
Simply call the endpoint without any parameters:
```bash
GET https://skinvaults.online/api/indexnow
```

This will automatically submit all URLs from your sitemap:
- https://skinvaults.online/
- https://skinvaults.online/inventory
- https://skinvaults.online/wishlist
- https://skinvaults.online/pro
- https://skinvaults.online/compare

### Method 2: Submit Specific URLs (POST)
Submit specific URLs by sending a POST request:
```bash
POST https://skinvaults.online/api/indexnow
Content-Type: application/json

{
  "urls": [
    "https://skinvaults.online/",
    "https://skinvaults.online/inventory",
    "https://skinvaults.online/item/some-skin-name"
  ]
}
```

### Example: Using cURL
```bash
# Submit all sitemap URLs
curl https://skinvaults.online/api/indexnow

# Submit specific URLs
curl -X POST https://skinvaults.online/api/indexnow \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://skinvaults.online/", "https://skinvaults.online/inventory"]}'
```

### Example: Using JavaScript (Client-side)
```javascript
// Submit all sitemap URLs
fetch('/api/indexnow')
  .then(res => res.json())
  .then(data => console.log(data));

// Submit specific URLs
fetch('/api/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    urls: [
      'https://skinvaults.online/',
      'https://skinvaults.online/inventory'
    ]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## When to Use IndexNow

Submit URLs to IndexNow when:
- ✅ You publish new content
- ✅ You update existing pages
- ✅ You add new items/products
- ✅ You make significant changes to pages
- ✅ After deploying updates to your site

## Response Codes

- **200 OK**: URLs submitted successfully
- **400 Bad Request**: Invalid format or empty URLs array
- **403 Forbidden**: API key not valid (check key file)
- **422 Unprocessable Entity**: URLs don't belong to your domain
- **429 Too Many Requests**: Rate limit exceeded (wait before retrying)

## Verification

1. **Check Bing Webmaster Tools**
   - Go to: https://www.bing.com/webmasters
   - Verify your domain ownership
   - Check "URL Submission" section to see submitted URLs

2. **Test the API Key File**
   - Visit: `https://skinvaults.online/99982adb45e64fb7b2e24712db654185.txt`
   - Should display: `99982adb45e64fb7b2e24712db654185`

3. **Test the API Endpoint**
   - Call: `GET https://skinvaults.online/api/indexnow`
   - Should return success message with submitted URLs

## Best Practices

1. **Don't spam**: Only submit URLs when content actually changes
2. **Batch submissions**: Submit multiple URLs in one request (up to 10,000 per request)
3. **Monitor rate limits**: Don't exceed 10,000 URLs per day per domain
4. **Verify ownership**: Ensure your API key file is accessible at the root URL

## Troubleshooting

### API Key File Not Found
- Ensure `public/99982adb45e64fb7b2e24712db654185.txt` exists
- Check file permissions
- Verify the file is accessible at the root URL

### URLs Not Being Indexed
- Wait 24-48 hours for Bing to process
- Check Bing Webmaster Tools for errors
- Verify URLs are valid and belong to your domain
- Ensure URLs are publicly accessible (not behind authentication)

### 403 Forbidden Error
- Verify API key file is accessible
- Check that the key in the file matches exactly
- Ensure file encoding is UTF-8

## Additional Resources

- IndexNow Documentation: https://www.indexnow.org/documentation
- Bing Webmaster Tools: https://www.bing.com/webmasters
- IndexNow Protocol Spec: https://www.indexnow.org/

