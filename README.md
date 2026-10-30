# FindToFill 🚰⚡

> **"Find it. Fill it."**
> A mobile-first web app for KRL Commuter Line passengers (Jabodetabek) to quickly find working water refill dispensers and charging stations inside stations.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router, Strict TypeScript)
- **Styling**: Tailwind CSS (Mobile-first responsive design, Inter font)
- **Icons**: Lucide React
- **Maps**: Leaflet & React-Leaflet with OpenStreetMap tiles
- **Testing**: Jest & React Testing Library

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.17+ or v20+)
- npm / pnpm / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/eugeniahwd/FindToFill.git
cd FindToFill

# Install dependencies
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the appropriate placeholders when configuring the backend in future sprints.

### Development Server

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser (open DevTools and toggle mobile device toolbar at 390×844 or 360×640).

### Running Tests

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Type Checking & Linting

```bash
# Lint code
npm run lint

# TypeScript check
npx tsc --noEmit
```

### Production Build

```bash
npm run build
npm run start
```
