# 🚀 Vercel Pro Deployment with Blob Storage

Since you have Vercel Pro, we can use **Vercel Blob Storage** for image uploads! This is perfect and keeps everything in one place.

## Step 1: Enable Vercel Blob Storage

1. Go to https://vercel.com/dashboard
2. Select your backend project (or create one)
3. Go to **Storage** tab
4. Click **Create Database** → Choose **Blob**
5. Click **Create**
6. Vercel will automatically add `BLOB_READ_WRITE_TOKEN` to your environment variables

## Step 2: Deploy Backend to Vercel

1. **Create new project for backend:**
   - Go to https://vercel.com/new
   - Import your repository: `xerostatic/tool-inventory`
   - Set **Root Directory** to: `backend`
   - Click **Deploy**

2. **Add environment variables to backend project:**
   
   Go to Settings → Environment Variables and add:

   ```
   DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   
   JWT_SECRET=tool-inventory-super-secret-jwt-key-2024
   
   NODE_ENV=production
   ```

   ⚠️ **Note:** `BLOB_READ_WRITE_TOKEN` is automatically added when you enable Blob Storage!

3. **Redeploy** after adding environment variables

4. **Copy your backend URL** (e.g., `https://tool-inventory-backend.vercel.app`)

## Step 3: Initialize Database (One-Time)

Run this locally to create tables:

```bash
cd backend
npm install
npm run init-db
```

You should see:
```
✅ Users table created
✅ Tools table created
✅ Indexes created
🎉 Database initialized successfully!
```

## Step 4: Configure Frontend

1. Go to your **frontend** project on Vercel
2. Go to Settings → Environment Variables
3. Add:

   ```
   REACT_APP_API_URL=https://your-backend.vercel.app/api
   ```
   
   ⚠️ Replace with your actual backend URL from Step 2!

4. **Redeploy** your frontend

## Step 5: Test Everything

1. Visit your frontend URL
2. Sign up for a new account
3. Try the **"Scan Tool"** button
4. Upload an image
5. It should analyze and pre-fill the form! ✨

## What Changed?

✅ **Before:** Images saved to local filesystem (won't work on Vercel)
✅ **Now:** Images uploaded to Vercel Blob Storage (works perfectly!)

The changes:
- Backend now uses `@vercel/blob` package
- Images stored in cloud, not locally
- Full URLs returned (e.g., `https://blob.vercel-storage.com/...`)
- Works on both local development and production

## Cost with Vercel Pro:

- **Pro Plan:** $20/month (you already have this)
- **Blob Storage:** 100 GB free, then $0.15/GB
- **For your use case:** Should stay well within free Blob Storage limits

## Troubleshooting

### Images not uploading:
- Make sure Blob Storage is enabled in your backend project
- Check that `BLOB_READ_WRITE_TOKEN` exists in environment variables
- Look at deployment logs for errors

### "Failed to fetch" error:
- Verify `REACT_APP_API_URL` is set in frontend project
- Make sure backend is deployed and accessible
- Check browser console for actual error

### Database errors:
- Make sure you ran `npm run init-db` once
- Verify Neon database is active (not paused)
- Check DATABASE_URL is correct

## Architecture Overview

```
Frontend (Vercel)
    ↓
Backend API (Vercel)
    ↓
├── Neon PostgreSQL (Database)
├── Vercel Blob (Image Storage)
└── Google Cloud Vision (Optional - Image Recognition)
```

Perfect for your setup! Everything stays on Vercel except the database (which is on Neon). 🎉

