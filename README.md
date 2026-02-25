# CollegePrep
CollegePrep simplifies student life by automating meal planning and budget tracking. Built with React, Redux, and Firebase, it syncs grocery lists and costs in real-time. It is a Pixel Perfect, accessible tool designed to help you eat healthy without overspending time.

This document establishes the technical standards and collaborative workflow for the MealPrep Joven project. All developers are required to follow these guidelines to ensure Clean Code, Pixel Perfect design, and consistent contributions.

**1. Technologies and Stack**
The project uses the following technologies to meet the performance and scalability requirements:
• Build Tool: Vite
• Frontend Framework: React
• Styling: Tailwind CSS with DaisyUI components
• State Management: Redux (Mandatory for global state synchronization)
• Code Quality: ESLint and Prettier for consistent formatting
• Backend/Auth: Firebase (For authentication and real-time updates)
• Deployment: Vercel or Netlify (Publicly accessible)
• API: MealDB API

**2. Setup Instructions**
Follow these steps to set up the local development environment:
1. Clone the repository:
2. Install dependencies:
3. Environment Setup: Create a .env file in the root directory and include the necessary Firebase and External API keys.
4. Run Development Server:
   
**3. Branching Model**
We follow a Feature Branch Workflow to maintain a stable main branch:
• main: Production-ready code only.
• develop: Main integration branch for the team.
• feat/feature-name: Dedicated branches for new features (e.g., feat/budget-logic).
• fix/bug-name: Dedicated branches for bug fixes.
Workflow: All features must be merged into develop via Pull Request before moving to main.

**4. Commits Convention**
All commit messages must be in English and follow the Conventional Commits standard:
• feat: A new feature (e.g., feat: integrate spoonacular api).
• fix: A bug fix (e.g., fix: mobile navigation overlap).
• docs: Documentation changes (e.g., docs: update readme).
• style: Formatting, missing semi-colons, or DaisyUI styling tweaks.
• refactor: Code changes that neither fix a bug or add a feature.

**5. Development Principles**
• English Only: All code, comments, and documentation must be in English.
• Componentization: UI must be broken down into small, reusable components.
• Accessibility: All features must support Keyboard Navigation and Screen Readers.
• Pixel Perfect: Final implementation must match the High-Fidelity designs provided in D1.
