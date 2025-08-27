# Gemini Global Dashboard - Supabase Setup Guide

## 🚀 Quick Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose an organization and enter project details:
   - **Name**: Gemini Global Dashboard
   - **Password**: Create a strong database password
   - **Region**: Choose closest to Canada (US West recommended)
4. Wait for the project to initialize (~2 minutes)

### 2. Configure Database
1. In your Supabase dashboard, go to **SQL Editor**
2. Copy and paste the entire content of `supabase-setup.sql` 
3. Click **Run** to create all tables, policies, and functions
4. Go to **Authentication** > **Settings** and enable:
   - Email authentication
   - Google OAuth (optional but recommended)

### 3. Get Your Credentials  
1. Go to **Settings** > **API**
2. Copy these values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **Anon Key** (long string starting with `eyJ...`)

### 4. Update Configuration
1. Open `supabase-config.js`
2. Replace the placeholder values:
```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-actual-anon-key-here';
```

### 5. Enable Real-time (Important!)
1. In Supabase dashboard, go to **Database** > **Replication**
2. Enable real-time for these tables:
   - `contacts` ✓
   - `activity_log` ✓  
   - `organization_members` ✓

## 🎯 Features Included

### ✅ **Authentication & Security**
- Email/password and Google OAuth sign-in
- Row-level security (users only see their organization's data)
- Automatic user profiles creation
- Secure session management

### ✅ **Real-time Collaboration**  
- **Live updates**: Changes sync instantly across all devices
- **Activity notifications**: See when team members add/edit contacts
- **Connection status**: Visual indicator of online/offline state
- **Conflict resolution**: Last-write-wins with change tracking

### ✅ **Team Management**
- **Multi-user organizations**: Share data with business partners
- **Role-based access**: Owner, Admin, Member, Viewer roles
- **Invite system**: Send email invites or share links
- **Activity logging**: Track who changed what and when

### ✅ **Data Migration**
- **Automatic migration**: Your existing localStorage data moves to Supabase
- **Offline fallback**: Still works if internet is down
- **Data export**: CSV/JSON export functionality maintained

## 👥 How to Share with Your Business Partner

### Method 1: Email Invitation
1. Click your profile picture (top right)
2. Select **"Invite Partner"**
3. Enter their email and choose role:
   - **Admin**: Can add/edit/delete contacts, manage team
   - **Member**: Can add/edit contacts
   - **Viewer**: Read-only access
4. Click **"Send Invite"**

### Method 2: Share Invite Link
1. In the invite modal, copy the generated link
2. Send via text/email to your partner
3. They'll be prompted to create an account and join your organization

## 🔧 Advanced Configuration

### Custom Domain (Optional)
If you want to use your own domain:
1. Set up custom domain in Supabase dashboard
2. Update the redirect URLs in auth settings

### Email Templates (Optional)  
Customize the welcome/invite emails in:
**Authentication** > **Templates**

### Backup Strategy
Your data is automatically backed up by Supabase, but you can:
1. Use the export feature regularly
2. Set up additional backups via Supabase CLI

## 🚨 Troubleshooting

### Common Issues:

**"Can't connect to database"**
- Check your SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Ensure your internet connection is working

**"Row Level Security policy violation"**  
- Make sure you ran the `supabase-setup.sql` script completely
- Check that real-time is enabled for required tables

**"Google sign-in not working"**
- Configure Google OAuth in Supabase Authentication settings
- Add your domain to authorized domains

**"Real-time updates not syncing"**
- Verify real-time is enabled for contacts, activity_log, and organization_members tables
- Check browser console for WebSocket errors

### Support
If you encounter issues:
1. Check the browser console for error messages
2. Verify all SQL setup steps were completed
3. Test with a fresh incognito window
4. Check Supabase project logs in dashboard

## 📱 Mobile Usage
The dashboard is fully responsive and works great on mobile devices with:
- Touch-friendly interface
- Swipe gestures (swipe right on contacts to call)
- Offline support with automatic sync when back online

Your Gemini Global Dashboard is now ready for real-time collaboration! 🎉