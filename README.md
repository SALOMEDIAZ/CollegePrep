# CollegePrep

> Meal planning for students: builds a weekly meal plan based on budget and profile preferences, and lets users explore recipes tailored to restrictions.

---

## Overview

Brief explanation of:

- What the project does
- Why it exists
- How it fits into the ecosystem

CollegePrep is a React + Vite web app that helps students plan meals for the week while tracking budget usage. It uses Firebase for authentication and Supabase as the app database (profiles, saved recipes, meal plans, ingredient pricing). Recipe data is pulled from TheMealDB API.

---

## Current Scope

### Features

- Authentication (Firebase): sign up, log in, log out
- Profile (Supabase): dietary preferences + allergies + avatar
- Recipes (TheMealDB): search + filter, with profile-based restrictions
- Meal Planner (Supabase): create weekly plan, persist meals, replace meals within remaining budget

### Status

> The repository is currently focused on establishing the technical foundation and core architecture of the module.

---

## Architecture

### Responsibilities

- UI rendering and navigation (React Router)
- Global state synchronization (Redux Toolkit)
- Data access layer for auth + database + external API (services/)

### Integrations

- Firebase Auth
- Supabase (database + storage)
- TheMealDB API

---

## Tech Stack

| Category | Technologies               |
| -------- | -------------------------- |
| Core     | React, TypeScript, Vite    |
| UI       | Tailwind CSS, DaisyUI      |
| State    | Redux Toolkit, React Redux |
| Testing  | Not configured             |
| Tooling  | ESLint                     |

> See `package.json` for exact versions.

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Installation

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

---

## Environment Variables

Create a `.env.local` file:

```env
# TheMealDB
VITE_MEALDB_API_KEY=1

# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_PERSISTENCE=session

# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Refer to project documentation for environment-specific values.

---

## Available Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| npm run dev     | Start development server         |
| npm run build   | Create production build          |
| npm run lint    | Run ESLint                       |
| npm run preview | Preview production build locally |

---

## Development Standards

- ESLint
- Conventional Commits

Example commit:

```text
feat: add conversation filters
```

---

## Project Structure

```text
src/
├── components/
├── pages/
├── routes/
├── services/
├── store/
├── styles/
├── types/
├── App.tsx
└── main.tsx
```

---

## Documentation

Additional documentation can be found under:

```text
docs/
```

---

## Ownership

**Team:** CollegePrep

**Maintainers:**

- Developer juanjoseholguin
- Developer SalomeDiaz
- Developer Codificator Tinoco
