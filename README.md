# BulkDM - Instagram DM Automation SaaS

A comprehensive SaaS platform for managing Instagram direct messages, campaigns, and automations with AI-powered features.

## 🚀 Features

- 🔐 **Multi-Account Support**: Connect and manage multiple Instagram accounts
- 💬 **Smart Inbox**: Unified inbox for all Instagram DMs with AI-powered organization
- 📊 **Campaign Management**: Create and manage DM campaigns with lead selection
- 🤖 **AI Automations**: Create intelligent automations for automated responses
- 📈 **Analytics Dashboard**: Track campaign performance and message statistics
- 🔔 **Notifications**: Email, push, and in-app notifications
- 👥 **Lead Generation**: Find leads using hashtags, user bios, and followers
- 🎯 **Target Audience**: Quick-select presets for different audience types
- 🔒 **User Management**: Secure workspace-based data isolation
- 🌐 **Direct Login**: Browser-based Instagram login without cookies

## 🛠 Tech Stack

### Backend
- **NestJS**: Node.js framework
- **Prisma**: ORM for database management
- **PostgreSQL**: Database (via Supabase)
- **Instagram Private API**: Instagram integration via cookie-based authentication
- **Puppeteer**: Browser automation for direct Instagram login

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling
- **Supabase**: Authentication and database client
- **PostHog**: Analytics tracking

### Extension
- **Chrome Extension**: One-click Instagram session extraction

## 📁 Project Structure

```
instagram-dm-saas/
├── backend/          # NestJS backend API
│   ├── src/
│   │   ├── instagram/    # Instagram integration services
│   │   ├── auth/         # Authentication guards
│   │   └── main.ts       # Application entry point
│   └── prisma/           # Database schema and migrations
├── frontend/         # Next.js frontend application
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities and helpers
│   └── public/           # Static assets
└── extension/        # Chrome extension for Instagram auth
    ├── popup.html        # Extension popup UI
    ├── popup.js          # Extension logic
    ├── background.js     # Service worker
    └── manifest.json     # Extension manifest
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (or Supabase)
- Chrome browser (for extension)
- Supabase account (for authentication)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd instagram-dm-saas
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Set up environment variables:**

**Backend** (`backend/.env`):
```env
DATABASE_URL=your_postgresql_connection_string
DIRECT_URL=your_direct_postgresql_connection_string
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_character_encryption_key
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

5. **Run database migrations:**
```bash
cd backend
npx prisma migrate dev
```

6. **Start the backend:**
```bash
cd backend
npm run start:dev
```

7. **Start the frontend:**
```bash
cd frontend
npm run dev
```

8. **Load the Chrome extension:**
- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked" and select the `extension/` folder

## 📖 Usage

### 1. Connect Instagram Account

**Option A: Direct Login (Recommended)**
- Go to Settings > Instagram Accounts
- Click "Connect with Direct Login"
- A browser window will open for Instagram login
- Your account connects automatically

**Option B: Chrome Extension**
- Install the BulkDM Chrome Extension
- Go to Settings > Instagram Accounts
- Click "Connect with Extension"
- Open Instagram and click the extension icon
- Click "Grab Instagram Session"

**Option C: Manual Cookies**
- Go to Settings > Instagram Accounts
- Click "Connect with Cookies"
- Enter your Instagram cookies manually

### 2. Create Campaigns

- Navigate to Campaigns
- Click "Create Campaign"
- Select leads/contacts
- Set message template
- Configure sending schedule
- Start the campaign

### 3. Set Up Automations

- Go to AI Studio
- Create automation rules
- Set trigger keywords
- Configure AI response templates
- Enable/disable as needed

### 4. Find Leads

- Go to Leads page
- Search by hashtag (user bio)
- Search by account followers
- Filter by engagement metrics
- Add leads to your contacts

### 5. Manage Inbox

- Navigate to Inbox
- View all conversations
- Reply to messages
- Use AI-powered quick replies
- Mark conversations as read/unread

## 🔧 Development

### Backend Development
```bash
cd backend
npm run start:dev
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Database Management
```bash
cd backend
npx prisma studio  # Open Prisma Studio
npx prisma migrate dev  # Create new migration
npx prisma generate  # Generate Prisma Client
```

### Extension Development
- Edit files in `extension/` directory
- Reload extension in Chrome: `chrome://extensions/` > Reload
- Test changes in extension popup

## 🌐 Deployment

### Frontend (Netlify)
See `NETLIFY_DEPLOYMENT.md` for detailed deployment instructions.

### Backend
Deploy to Railway, Render, or your preferred Node.js hosting platform.

### Extension
See `EXTENSION_DEPLOYMENT.md` for Chrome Web Store publishing instructions.

## 🔐 Security

- **Row Level Security (RLS)**: All database queries are protected by Supabase RLS policies
- **Workspace Isolation**: Users can only access data within their workspace
- **Encrypted Cookies**: Instagram cookies are encrypted before storage
- **Secure Authentication**: Supabase Auth with email verification

## 📊 Analytics

PostHog is integrated for:
- User behavior tracking
- Feature usage analytics
- Error monitoring
- Performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

[Your License Here]

## 🆘 Support

For issues and questions:
- Check the documentation in `/docs`
- Open an issue on GitHub
- Contact support at [your-email]

## 🎯 Roadmap

- [ ] WhatsApp integration
- [ ] Telegram integration
- [ ] Advanced AI models
- [ ] Team collaboration features
- [ ] API access
- [ ] Webhooks
- [ ] Mobile app

---

Built with ❤️ by the BulkDM team
