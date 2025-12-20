# 🚀 Vercel Deployment Guide

## Step 1: Deploy Backend

1. **Create a new Vercel project for backend:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Set the **Root Directory** to `backend`
   - Click **Deploy**

2. **Add Environment Variables in Vercel (Backend):**
   - Go to your backend project settings → Environment Variables
   - Add these variables:

   ```
   DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   
   JWT_SECRET=tool-inventory-super-secret-jwt-key-2024
   
   NODE_ENV=production
   ```

3. **Initialize your database:**
   - After deployment, you need to run the init-db script once
   - You can do this locally by running: `cd backend && npm run init-db`
   - Or use Vercel CLI to run it once after deployment

4. **Copy your backend URL:**
   - After deployment, you'll get a URL like: `https://your-backend.vercel.app`
   - Copy this URL for the next step

## Step 2: Deploy Frontend

1. **Configure Frontend Environment Variable:**
   - In your **frontend** Vercel project (the main repository)
   - Go to Settings → Environment Variables
   - Add:
   
   ```
   REACT_APP_API_URL=https://your-backend.vercel.app/api
   ```
   
   ⚠️ Replace `your-backend.vercel.app` with your actual backend URL from Step 1!

2. **Redeploy Frontend:**
   - After adding the environment variable, trigger a new deployment
   - Or go to Deployments tab → Click the three dots → Redeploy

## Step 3: Test Your App

1. Visit your frontend URL (e.g., `https://tool-inventory.vercel.app`)
2. Try signing up with a new account
3. Add some tools to your inventory

## Important Notes:

### Image Upload Limitation on Vercel
Vercel's serverless functions have limitations with file uploads. For image recognition to work in production, you'll need to:

**Option A:** Use a different backend hosting (Recommended for image uploads)
- **Railway.app** (Free tier available)
- **Render.com** (Free tier available)
- **Fly.io** (Free tier available)

**Option B:** Modify the backend to use cloud storage
- Upload images to Cloudinary, AWS S3, or similar
- This requires code modifications

### CORS Configuration
The backend is already configured with `cors()` middleware to accept requests from any origin. If you want to restrict it to your frontend domain only, update `server.js`:

```javascript
app.use(cors({
  origin: 'https://your-frontend.vercel.app',
  credentials: true
}));
```

## Alternative: Deploy Backend to Railway

If you want better support for image uploads, use Railway instead:

1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables (same as above)
6. Railway will give you a URL like `https://your-app.railway.app`
7. Use this URL in your frontend's `REACT_APP_API_URL`

## Troubleshooting

### "Failed to fetch" error:
- Make sure `REACT_APP_API_URL` environment variable is set in Vercel
- Make sure it includes `/api` at the end
- Verify your backend is deployed and accessible
- Check browser console for the actual error

### "Invalid credentials" or database errors:
- Verify your Neon database URL is correct
- Make sure you ran `init-db.js` to create tables
- Check that your Neon database is not paused

### Image upload not working:
- This is expected on Vercel due to serverless limitations
- Deploy backend to Railway, Render, or Fly.io instead
- Or implement cloud storage solution

## Current Setup

Right now your app is configured to use:
- ✅ Neon PostgreSQL (works on Vercel)
- ✅ JWT Authentication (works on Vercel)
- ⚠️ Local file storage for images (won't work on Vercel)

For development: Run both servers locally (`start-app.bat`)
For production: Follow the steps above to deploy to Vercel or Railway

