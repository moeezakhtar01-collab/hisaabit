# Hisaab - Personal Finance Tracker for Pakistan

## Overview
Hisaab is a mobile expense tracking app built specifically for Pakistani households. It helps users track daily spending in PKR with categories relevant to Pakistani life (Kiryana, Sabzi Mandi, Bijli Bill, etc.).

## Architecture
- **Frontend**: Expo React Native with Expo Router (file-based routing)
- **Backend**: Express.js (serves landing page and API)
- **Storage**: AsyncStorage for local data persistence
- **Fonts**: Inter (Google Fonts)
- **State**: useState + useEffect with polling for data refresh

## Project Structure
- `app/(tabs)/` - Tab screens (Home, Budgets, History)
- `app/add-expense.tsx` - Modal screen for adding expenses
- `components/` - Reusable UI components (ExpenseCard, CategoryPill, BudgetBar, SpendingChart)
- `lib/storage.ts` - AsyncStorage CRUD operations and category definitions
- `constants/colors.ts` - Theme colors with Pakistani-inspired green palette

## Key Features
- Quick expense logging with PKR currency
- 13 Pakistani-relevant expense categories
- Monthly budget tracking per category
- Spending breakdown with visual charts
- Expense history with category filtering and month navigation
- Pull-to-refresh and real-time data sync

## Design
- Emerald green primary color palette
- Inter font family
- iOS liquid glass tabs support (iOS 26+)
- Cards with subtle borders, rounded corners
- Animated transitions with react-native-reanimated
