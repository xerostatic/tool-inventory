# ✨ Simple One-Click Deployment

This is now a **single-project deployment**! No more separate frontend/backend headaches.

**Last updated:** December 20, 2025

## 🚀 Deploy to Vercel (Super Simple)

1. **Go to Vercel:** https://vercel.com/new

2. **Import your GitHub repo:** `xerostatic/tool-inventory`

3. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add these two:
   
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   
   JWT_SECRET=fdkjh398732hg8bfd87g387gpduh9802hgpwbsiu
   ```

4. **Click Deploy**

That's it! ✅ Your app will be live in 2 minutes.

## 📱 How It Works Now

- **Frontend:** React app (root of repo)
- **Backend:** Vercel Serverless Functions (`/api` folder)
- **Database:** Neon PostgreSQL (already initialized)
- **One deployment, one URL, done!**

## 🏠 Run Locally

```bash
# Initialize database (only needed once)
cd backend
npm install
npm run init-db
cd ..

# Run the app
npm install
npm start
```

The frontend will run on `http://localhost:3000` and automatically proxy API calls to your Vercel backend.

## 🔄 Auto-Deploy

Every time you push to `main` branch, Vercel automatically redeploys. No manual steps needed!

## 🎯 No More:
- ❌ Separate backend project
- ❌ Setting frontend API URL
- ❌ Managing two deployments
- ❌ CORS issues

## ✅ Yes More:
- ✅ One project, one deployment
- ✅ Push and forget
- ✅ Everything just works

That's the power of simplicity! 🎉

