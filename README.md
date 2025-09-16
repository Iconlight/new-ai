# Welcome to your Expo# ProactiveAI - Intelligent Conversation Companion

A React Native Expo app that provides proactive AI conversations based on user interests, featuring ChatGPT-like interface, daily conversation starters, and push notifications.

## Features

- **Proactive AI Conversations**: AI initiates conversations based on your interests, current date, and trending topics
- **ChatGPT-like Interface**: Modern chat UI with message history and context retention
- **Daily Push Notifications**: Receive 3 personalized conversation starters daily
- **Interest-based Personalization**: Onboarding with predefined and custom interests
- **Multiple Chat Sessions**: Create and manage multiple conversations
- **Secure Authentication**: Supabase Auth with email/password
- **Dark/Light Theme**: Material Design 3 theming
- **Profile Management**: View interests, preferences, and account settings

## Tech Stack

- **Frontend**: React Native, Expo SDK 54
- **UI Framework**: React Native Paper (Material Design 3)
- **Navigation**: Expo Router
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI Integration**: OpenAI GPT-3.5-turbo
- **Chat UI**: React Native Gifted Chat
- **Notifications**: Expo Notifications
- **State Management**: React Context API

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- Physical device or emulator for testing

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd active
npm install
```

### 3. Environment Configuration

Update the `.env` file with your API keys:

```env
# Supabase Configuration (already configured)
EXPO_PUBLIC_SUPABASE_URL=https://xqwnwuydzkriwxxsraxm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd253dXlkemtyeHd4eHNyYXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTQyNzQsImV4cCI6MjA3MzQ5MDI3NH0.GFmQgGbuzF7ZLDccSdxUTcBSKOJ-k7IdmM_diOgXZ4s

# AI Configuration (REQUIRED)
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Push Notifications (Optional)
EXPO_PUBLIC_EXPO_PROJECT_ID=your_expo_project_id_here
```

### 4. Database Setup

The Supabase database schema is provided in `supabase-schema.sql`. Run this SQL in your Supabase SQL editor:

```sql
-- See supabase-schema.sql for complete schema
```

### 5. Run the App

```bash
# Start the development server
npx expo start

# Run on specific platforms
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Project Structure

```
src/
├── contexts/          # React Context providers
│   ├── AuthContext.tsx
│   ├── ChatContext.tsx
│   └── NotificationContext.tsx
├── services/          # External service integrations
│   ├── supabase.ts
│   ├── ai.ts
│   ├── notifications.ts
│   └── proactiveAI.ts
├── theme/            # Material Design theme
│   └── index.ts
└── types/            # TypeScript type definitions
    └── index.ts

app/
├── (auth)/           # Authentication screens
│   ├── index.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/           # Main app tabs
│   ├── index.tsx     # Chat list
│   ├── chat/[id].tsx # Chat interface
│   └── profile.tsx   # User profile
├── onboarding.tsx    # Interest selection
└── _layout.tsx       # Root layout
```

## Key Features Implementation

### Proactive AI System
- Generates conversation starters based on user interests and current trends
- Schedules 3 daily notifications (9 AM, 2 PM, 7 PM)
- Stores conversation topics in database for tracking

### Chat Interface
- Real-time messaging with AI responses
- Message history persistence
- Context-aware conversations using user interests
- Multiple chat sessions with individual contexts

### User Onboarding
- Interest selection from predefined categories
- Custom interest addition
- Automatic profile creation with Supabase triggers

### Notification System
- Daily push notifications with conversation starters
- Configurable notification preferences
- Background notification scheduling

## API Keys Required

1. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Expo Project ID**: Get from [Expo Dashboard](https://expo.dev/) (for push notifications)

## Database Schema

The app uses the following main tables:
- `profiles`: User account information
- `user_interests`: User's selected interests
- `user_preferences`: Notification and app preferences
- `chats`: Chat session metadata
- `messages`: Individual chat messages
- `proactive_topics`: Generated conversation starters

## Deployment

### Mobile App
```bash
# Build for production
eas build --platform android
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

### Database
The Supabase instance is already configured and ready to use.

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Run `npm install` to ensure all dependencies are installed
2. **Supabase Connection**: Verify the URL and anon key in `.env`
3. **AI Responses**: Ensure OpenAI API key is valid and has credits
4. **Notifications**: Test on physical device (notifications don't work in simulator)

### Development Tips

- Use Expo Go app for quick testing
- Enable hot reload for faster development
- Check Expo DevTools for debugging
- Monitor Supabase logs for database issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Expo and Supabase documentation
- Create an issue in the repository
