# Contributing Guide

First off, thank you for considering contributing to the **Cosmic KPI Master App**! 

This is an internal proprietary tool, but we welcome improvements, bug fixes, and feature additions from the team.

## Branching Strategy

- **`main`**: The primary operational branch. Must always be stable.
- **`feature/*`**: Create a branch starting with `feature/` for any new addition (e.g., `feature/new-kpi-metrics`).
- **`fix/*`**: Create a branch starting with `fix/` for bug fixes (e.g., `fix/login-page-logo`).

## Workflow

1. Update your local `main` branch: `git pull origin main`
2. Create your branch: `git checkout -b feature/your-feature-name`
3. Commit your changes. Ensure commit messages are clear and descriptive (we prefer conventional commits like `feat:`, `fix:`, `chore:`).
4. Run tests before completing: `npm run test`
5. Push to the repository and open a Pull Request (PR) against `main`.
6. Request a review from the repository owner or another team member.

## Code Standards
- We use **TypeScript** strictly. Keep types properly defined.
- Run `npm run lint` if available to ensure formatting consistency.
- Any modifications to data structures must be accompanied by relevant updates to `/tests`.
