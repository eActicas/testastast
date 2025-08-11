# 🚀 MuLegends.eu - Railway Setup Instructions

## 🎯 **Quick Railway Deployment Guide**

### **What You're Getting:**
- ✅ **Frontend:** https://mulegends.eu (IV.lt - already working)
- ✅ **Backend:** Railway.app (free tier)
- ✅ **Database:** IV.lt MySQL (already configured)

---

## **Step 1: Deploy to Railway (10 minutes)**

### **1.1 Go to Railway**
1. Visit: https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub (free account)

### **1.2 Create Project**
1. Click "New Project"
2. Select "Empty Project"
3. Name it: `mulegends-backend`

### **1.3 Upload Files**
Upload all files from your `RAILWAY_DEPLOYMENT/` folder:
- `server.js`
- `package.json`
- `.env`
- `railway.json`

**How to upload:**
- **Option A:** Drag & drop files into Railway dashboard
- **Option B:** Connect GitHub repository (recommended)

### **1.4 Set Environment Variables**
In Railway dashboard → Variables, add:
```
DB_HOST=mulegends.eu
DB_USER=muends_idle_mmo_game
DB_PASSWORD=FqPtkK9fxD9ZAFXV
DB_NAME=muends_idle_mmo_game
DB_PORT=3306
NODE_ENV=production
JWT_SECRET=mu_online_idle_mmo_secret_key_2024_production_secure_token_railway
```

### **1.5 Deploy**
1. Railway automatically builds and deploys
2. You'll get a URL like: `https://mulegends-backend-production-xxxx.up.railway.app`
3. **Copy this URL - you'll need it!**

---

## **Step 2: Test Backend (5 minutes)**

### **2.1 Check if Backend is Running**
Visit your Railway URL in browser:
- Should show: "MU Online Idle MMO Server is running!"

### **2.2 Test Database Connection**
Visit: `https://your-railway-url.up.railway.app/api/health`
- Should show: "Database connected successfully"

**If you see database errors:**
- Check if IV.lt allows remote MySQL connections
- Contact IV.lt support to enable remote database access

---

## **Step 3: Update Frontend (5 minutes)**

### **3.1 Create Updated Frontend File**
I'll provide you with an updated `index.html` that connects to Railway.

### **3.2 Upload to IV.lt**
Replace your current `index.html` on IV.lt with the Railway-configured version.

---

## **Step 4: Final Test (5 minutes)**

### **4.1 Test Your MMO**
1. Visit https://mulegends.eu
2. Register new account
3. Create character
4. Test inventory, combat, guilds

### **4.2 Verify Everything Works**
- ✅ User registration
- ✅ Character creation
- ✅ Game features
- ✅ Real-time updates

---

## **🎯 Next Steps:**

1. **Deploy to Railway first** (follow steps above)
2. **Get your Railway URL**
3. **Tell me the URL** and I'll create the updated frontend
4. **Upload updated frontend** to IV.lt
5. **Test and go live!**

---

## **💰 Cost Breakdown:**

### **Current Setup:**
- ✅ **IV.lt hosting:** Your current plan (domain + email working)
- ✅ **Railway backend:** FREE (includes $5/month credit)
- ✅ **Total additional cost:** $0/month

### **Professional Benefits:**
- ✅ Scalable architecture
- ✅ Industry-standard setup
- ✅ Easy maintenance
- ✅ Automatic deployments
- ✅ Built-in monitoring

---

## **🆘 Need Help?**

If you run into any issues:
1. **Database connection errors:** Contact IV.lt support about remote MySQL access
2. **Railway deployment errors:** Check the build logs in Railway dashboard
3. **Frontend connection issues:** Make sure you're using the correct Railway URL

**Your MuLegends.eu MMO is almost ready to go live!** 🎮⚔️

---

**Ready to start? Just deploy to Railway and let me know your backend URL!** 🚀
