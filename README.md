# FridgeMind

AI-powered inventory and meal-planning assistant that eliminates household cognitive load around food.

> "Take photos. Get clarity. Eat smart. Live lighter."

## Overview

FridgeMind uses **photo recognition**, **predictive restocking**, and **meal-based planning** to ensure no forgotten food, overbuying, or midweek stress.

### Key Features

- **Visual Inventory**: Take photos of your fridge/freezer/pantry, AI identifies all items
- **Smart Expiry Tracking**: Know what needs to be used soon
- **Meal Count Planning**: Input meals at home this week, get a precise shopping list
- **Predictive Restocking**: System learns your patterns and suggests reorders
- **Craving Integration**: Say "want curry" and get the ingredients added to your list

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI Vision**: Google Gemini 2.0 Flash
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Google AI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/erictisme/fridgemind.git
cd fridgemind

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Fill in your environment variables in .env.local

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

See `.env.example` for required variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `GOOGLE_AI_API_KEY` - Google AI (Gemini) API key

## Documentation

- [Full PRD](./docs/FRIDGEMIND-PRD.md) - Complete product requirements document

## Development

This project uses [Superpowers](https://github.com/obra/superpowers) for structured AI-assisted development with test-driven development workflows.

```bash
# Run tests
pnpm test

# Build for production
pnpm build

# Lint
pnpm lint
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components
├── lib/           # Utilities (Supabase client, Gemini integration)
├── hooks/         # Custom React hooks
├── stores/        # Zustand state stores
└── types/         # TypeScript type definitions
```

## License

MIT
