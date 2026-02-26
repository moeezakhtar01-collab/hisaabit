# Hisaabit - Personal Finance Tracker for Pakistan

## Overview
Hisaabit is a mobile expense tracking app built specifically for Pakistani households. It helps users track daily spending in PKR with categories relevant to Pakistani life (Grocery, Sabzi Mandi, Bijli Bill, etc.).

## Architecture
- **Frontend**: Expo React Native with Expo Router (file-based routing)
- **Backend**: Express.js (serves landing page and API)
- **Database**: PostgreSQL (Neon) via Drizzle ORM (postgres-js driver) for user accounts
- **Storage**: Server-side PostgreSQL for all data persistence
- **Auth**: express-session + connect-pg-simple + bcrypt, session-based auth
- **Fonts**: Inter (Google Fonts)
- **State**: useState + useEffect with polling for data refresh; AuthContext for auth state

## Project Structure
- `app/(tabs)/` - Tab screens (Home, Budgets, History)
- `app/login.tsx` - Login screen
- `app/register.tsx` - Registration screen
- `app/forgot-password.tsx` - Password reset request screen
- `app/add-expense.tsx` - Modal screen for adding expenses
- `app/voice-expense.tsx` - Voice expense entry (OpenAI Whisper + GPT-4o-mini)
- `app/subscription.tsx` - Subscription plan management (Free/Pro)
- `components/` - Reusable UI components (ExpenseCard, CategoryPill, BudgetBar, SpendingChart)
- `lib/storage.ts` - AsyncStorage CRUD operations and category definitions
- `lib/auth-context.tsx` - AuthProvider and useAuth hook for auth state management
- `server/routes.ts` - API routes (auth + voice expense)
- `server/storage.ts` - Database CRUD operations for users
- `server/db.ts` - Drizzle ORM + postgres-js database connection
- `app/period-expenses.tsx` - Modal screen for viewing daily/weekly expense lists
- `shared/schema.ts` - Drizzle schema (users, expenses, budgets, monthlyBudgets, budgetSettings tables)
- `constants/colors.ts` - Theme colors with Pakistani-inspired green palette

## Key Features
- User authentication (register, login, password reset)
- Protected routes (auth gate in root layout)
- Quick expense logging with PKR currency
- Voice expense entry via AI (Whisper transcription + GPT extraction) with date detection
- 13 Pakistani-relevant expense categories
- Daily, weekly, and monthly budget tracking
- Tappable daily/weekly summary cards on home screen showing expenses for the period
- Spending breakdown with visual charts
- Expense history with Monthly/Weekly/Daily tabs and expandable period sections
- Pull-to-refresh and real-time data sync
- Daily reminder notifications (expo-notifications, user-configurable time picker in settings)
- Subscription plans (Free/Pro): Free has 10 AI voice entries limit + single expense per recording; Pro has unlimited voice + multi-expense per recording

## Design
- Emerald green primary color palette
- Inter font family
- iOS liquid glass tabs support (iOS 26+)
- Cards with subtle borders, rounded corners
- Animated transitions with react-native-reanimated
