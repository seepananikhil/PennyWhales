# Deployment Guide for PennyWhales

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
3. **GitHub Repository**: Push your code to GitHub

## Environment Variables

You need to set the following environment variable in Vercel:

- `DATABASE_URL` - Your MongoDB connection string from MongoDB Atlas

Example:
```
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/pennywhales?retryWrites=true&w=majority"
```

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin master
   ```

2. **Import to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your PennyWhales repository
   - Configure project:
     - **Framework Preset**: Other
     - **Root Directory**: `./`
     - **Build Command**: `cd web && npm install && npm run build`
     - **Output Directory**: `web/build`

3. **Add Environment Variables**:
   - In the Vercel project settings, go to "Environment Variables"
   - Add `DATABASE_URL` with your MongoDB connection string

4. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete

### Option 2: Deploy via CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   # or use npx
   npx vercel --version
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add DATABASE_URL production
   # Paste your MongoDB connection string when prompted
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

## MongoDB Atlas Setup

1. **Create Cluster**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free M0 cluster
   - Choose a cloud provider and region

2. **Create Database User**:
   - Go to "Database Access"
   - Add a new database user with read/write permissions
   - Save the username and password

3. **Whitelist IP Addresses**:
   - Go to "Network Access"
   - Add IP Address: `0.0.0.0/0` (allow from anywhere - for Vercel)

4. **Get Connection String**:
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `pennywhales`

## Prisma Schema Setup

After deploying, you need to push the Prisma schema to your MongoDB database:

```bash
cd api
npx prisma generate
npx prisma db push
```

## Verify Deployment

1. **Frontend**: Your app will be available at `https://your-project.vercel.app`
2. **API**: Test the API at `https://your-project.vercel.app/api/health`

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### API Not Working
- Verify `DATABASE_URL` environment variable is set
- Check MongoDB Atlas network access allows `0.0.0.0/0`
- Check API logs in Vercel dashboard

### Database Connection Issues
- Ensure MongoDB connection string is correct
- Verify database user has proper permissions
- Check if IP whitelist includes `0.0.0.0/0`

## Post-Deployment

1. **Set up Prisma**:
   ```bash
   cd api
   npx prisma generate
   npx prisma db push
   ```

2. **Initialize Database**:
   - Visit `https://your-project.vercel.app/api/health` to trigger database initialization

3. **Start First Scan**:
   - Use the dashboard UI to trigger your first stock scan

## Continuous Deployment

Once set up, Vercel will automatically deploy:
- Every push to `master` branch → Production
- Every pull request → Preview deployment

## Custom Domain (Optional)

1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions
