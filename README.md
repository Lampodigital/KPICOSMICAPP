# KPI Master App

A sophisticated internal analytics dashboard and data normalization tool for managing, analyzing, and exporting highly refined structural KPIs.

## Features

- **Data Normalization Engine:** Standardizes input data by converting headers, processing null values, and parsing currencies/ratios flawlessly.
- **Outlier Detection:** Intelligent multi-pass Interquartile Range (IQR) analysis to clean anomalies while retaining statistical significance across variable dataset sizes.
- **KPI Registry:** Centralized configuration block mapping visual presentations (labels, formatting, descriptions) to canonical data keys.
- **Supabase Integration:** Full database sync, Row Level Security (RLS) integration, and seamless user authentication.
- **Dynamic Configuration:** App-wide config accessible via internal APIs and managed through an administrative dashboard.
- **Cosmic UI/UX Theme:** A responsive, premium dark-mode aesthetic utilizing rich globals tokens.

## Tech Stack

This project is built using:
- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Database / Auth:** [Supabase](https://supabase.com/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Styling:** Vanilla CSS & TailwindCSS
- **Testing:** [Vitest](https://vitest.dev/)
- **Languages:** TypeScript, React

## Getting Started

### Prerequisites

You need `Node.js 20+` and `npm` installed on your machine.
Ensure you have access to the associated Supabase project.

### Environment Setup

Create a `.env.local` file at the root of the project with the following keys:

```env
# Database Credentials
DATABASE_URL="postgres://[db-user]:[db-password]@[db-host]:[db-port]/[db-name]"
DIRECT_URL="postgres://[db-user]:[db-password]@[db-host]:[db-port]/[db-name]"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[your-project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Push the Prisma schema to sync your database:
   ```bash
   npm run db:push
   ```

3. (Optional) Run Prisma Studio to view database contents:
   ```bash
   npm run db:studio
   ```

### Development 

Run the development server natively:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Testing

This project utilizes `vitest` to ensure robust structural validation, specifically for the Statistical logic and Data Normalization engine.

To run the unified test suite:
```bash
npm run test
```
*(Tests cover `normalize`, `outliers`, `registry`, and mapping `utils`)*

## Repository Structure

- `/src/app`: Next.js App Router structured pages and API routes.
- `/src/lib`: Core logical tools (`/data`, `/kpis`, `/outliers`, `/db`).
- `/public`: Static assets including brand resources.
- `/prisma`: Database schemas and seed data.
- `/tests`: Vitest testing suites for programmatic validation. 

## License
Proprietary / Internal. Not for public distribution.
