# 🚀 Quick Setup Guide

Follow these steps to get your Tool Inventory app running in under 5 minutes!

## Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

## Step 2: Create Backend Environment File

Create a file called `.env` in the `backend` folder with this content:

```env
DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET=tool-inventory-super-secret-jwt-key-2024

PORT=5000
NODE_ENV=development
```

## Step 3: Initialize the Database

```bash
npm run init-db
```

You should see:
```
✅ Users table created
✅ Tools table created
✅ Indexes created
🎉 Database initialized successfully!
```

## Step 4: Start the Backend Server

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 5000
📊 Environment: development
🗄️  Database: Connected to Neon PostgreSQL
🔐 JWT Authentication: Enabled
📸 Vision API: Disabled (optional)
```

## Step 5: Install Frontend Dependencies

Open a NEW terminal window and run:

```bash
npm install
```

## Step 6: Start the Frontend

```bash
npm start
```

The app will open in your browser at `http://localhost:3000`

## Step 7: Create Your Account

1. Click "Don't have an account? Sign up"
2. Enter your email and password (minimum 6 characters)
3. Click "Sign Up"

You're all set! 🎉

## Optional: Enable Image Recognition

If you want AI-powered tool recognition from photos:

### 1. Set Up Google Cloud Vision API

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable the **Cloud Vision API**:
   - Search for "Vision API" in the search bar
   - Click "Enable"
4. Create a service account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "tool-inventory-vision")
   - Grant role: "Cloud Vision API User"
   - Click "Done"
5. Create and download credentials:
   - Click on your service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON"
   - Download the file

### 2. Add Credentials to Backend

1. Save the downloaded JSON file as `google-credentials.json` in the `backend` folder
2. Add this line to your `backend/.env` file:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
   ```
3. Restart the backend server

Now you'll see:
```
📸 Vision API: Enabled
```

## Testing the App

### Test Manual Entry
1. Click "Add Item"
2. Fill in the form
3. Click "Add Item"
4. See it appear in your inventory

### Test Image Recognition (if enabled)
1. Click "Scan Tool"
2. Upload a photo of a tool
3. Click "Recognize Tool"
4. The form will auto-fill with detected information
5. Review and save

## Troubleshooting

### "Failed to load tools" error
- Make sure the backend server is running on port 5000
- Check that you ran `npm run init-db`
- Verify your DATABASE_URL in `.env`

### Backend won't start
- Make sure you created the `.env` file in the `backend` folder (not root)
- Check if another program is using port 5000
- Try `npm install` again in the backend folder

### "Cannot find module" errors
- Run `npm install` in both root folder AND backend folder
- Make sure you're in the correct directory

### Database initialization fails
- Check your Neon database connection string
- Make sure your Neon database is active (not paused)
- Try connecting to Neon dashboard to verify it's working

## Need Help?

1. Check the main README.md for detailed documentation
2. Look at the API endpoints in backend/server.js
3. Check browser console for frontend errors
4. Check terminal for backend errors

Happy tool tracking! 🛠️

