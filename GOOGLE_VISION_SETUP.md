# 🤖 Google Cloud Vision API Setup

Your Google Cloud Vision credentials are ready! This enables automatic tool recognition from photos.

## ✅ Already Done:

- ✅ `backend/google-credentials.json` created
- ✅ Added to `.gitignore` (won't be committed to GitHub)
- ✅ Backend code updated to support both local and production

## 🔧 Local Development Setup:

Create a file `backend/.env` with this content:

```env
DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET=fdkjh398732hg8bfd87g387gpduh9802hgpwbsiu

PORT=5000
NODE_ENV=development

GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

Now when you run `npm run dev` in the backend folder, you'll see:
```
✅ Google Cloud Vision API initialized (from file)
```

## 🚀 Production (Vercel) Setup:

Since you can't upload files to Vercel, use the JSON as an environment variable:

1. Go to your **backend** project on Vercel
2. Settings → Environment Variables
3. Add a new variable:
   - **Name:** `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - **Value:** Copy the ENTIRE content of `backend/google-credentials.json`

   💡 **How to get it:**
   - Open `backend/google-credentials.json` in your text editor
   - Select all text (Ctrl+A)
   - Copy it (Ctrl+C)
   - Paste into Vercel as ONE LINE (minified JSON)
   
   It should look like: `{"type":"service_account","project_id":"your-project",...}`

4. Redeploy your backend

You should see in the deployment logs:
```
✅ Google Cloud Vision API initialized (from env)
```

## 🎯 What It Does:

When you upload a tool image, it will:

1. **Detect tool type:**
   - Wrench → Category: "Wrenches"
   - Drill → Category: "Power Tools"
   - Socket → Category: "Sockets & Drives"
   - Hammer → Category: "Hand Tools"
   - etc.

2. **Read brand names from text in image:**
   - Detects: Snap-On, Mac, Matco, Milwaukee, DeWalt, Craftsman, etc.

3. **Auto-estimate value based on brand:**
   - Snap-On: $100-500 average
   - Mac/Matco: $80-400 average
   - Milwaukee/DeWalt: $50-300 average
   - Craftsman: $30-200 average
   - Other: $50 default

4. **Pre-fill the form** so you just review and click "Add Item"!

## 💰 Cost:

Google Cloud Vision API pricing:
- **First 1,000 requests/month:** FREE
- **After that:** $1.50 per 1,000 images

For personal use, you'll likely stay in the free tier! 🎉

## 🧪 Test It:

1. Start your backend: `cd backend && npm run dev`
2. Start your frontend: `npm start`
3. Click **"Scan Tool"**
4. Upload a photo of a tool
5. Watch it auto-fill the details! ✨

## ⚠️ Security Note:

- ✅ `google-credentials.json` is in `.gitignore` (safe)
- ✅ Won't be committed to GitHub (safe)
- ✅ Only you have access (safe)
- ⚠️ Never share this file or the JSON content publicly!

Happy tool scanning! 🔧🤖

