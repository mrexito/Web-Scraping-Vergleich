# Comparison Portal for Grammar School Preparation Courses

> **Bachelor Thesis** · Bern University of Applied Sciences (BFH) · Department of Business · BSc Business Information Technology · 2026

A web-based comparison portal that helps parents and students in the Canton of Zurich
identify the most suitable Gymi preparation course provider based on individually weighted
criteria. The system applies a Multi-Criteria Decision Analysis (MCDA) model to evaluate
and rank providers using real, automatically scraped data.

---

## Project Scope

This thesis covers:

- **Web scraping system** with three frameworks (Puppeteer, ScrapeGraphAI, Bright Data)
  for comparative evaluation
- **AI-based self-healing loop** using BFH LLM and Gemini 2.5 Flash to detect and recover
  from selector breakages
- **Weighted scoring model** with 6 evaluation criteria (price, quality, location,
  flexibility, services, digital learning environment)
- **Type-safe data layer** using Zod schemas and Supabase with auto-generated TypeScript types
- **Modern UX/UI** designed in Lovable, ported to Next.js with Tailwind CSS v4

---

## Architecture

The repository follows a **modular monorepo** pattern that separates the user-facing web
application from the data extraction pipeline, while sharing data schemas and database
utilities.

This structure provides:

- **Clear separation of concerns** (web vs. data pipeline)
- **Shared type safety** through Zod schemas
- **Independent scaling** (scrapers can run on different infrastructure)
- **Single source of truth** for the database model

---

## Tech Stack

### Web Application
- Next.js 15 with App Router and React 19
- TypeScript with strict mode
- Tailwind CSS v4 with design tokens (oklch color space)
- shadcn/ui (new-york style) with Radix UI primitives
- next-themes for light/dark mode
- Geist font (lokal gebundelt)
- Zustand for client state
- Zod for runtime validation

### Data Layer
- Supabase (PostgreSQL) with normalized schema
  - `GymiProviders`, `CourseDetails`, `courses`
  - `zap_info` (ZAP terms and exam information)
  - `scrape_runs`, `scrape_errors`, `price_history`
- Auto-generated TypeScript types via `supabase gen types`

### Scraping Frameworks
- **Puppeteer** — Browser automation (TypeScript)
- **ScrapeGraphAI** — LLM-based extraction with BFH LLM (Python)
- **Bright Data** — Proxy-based scraping (Python)
- **Self-Healing Loop** — Gemini 2.5 Flash for selector regeneration

---

## Local Setup

### Prerequisites

- Node.js v20.17+ (Node v22.12+ or higher recommended)
- npm v10+
- Python 3.11+ (only required if running Python scrapers)
- A Supabase project with the schema set up

### Web Application

1. **Clone the repository**
```bash
   git clone https://github.com/TamStefBFH/bachelor-thesis-comparison-portal.git
   cd bachelor-thesis-comparison-portal
```

2. **Install dependencies**
```bash
   npm install
```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the values:
Credentials are excluded from version control. For evaluation purposes,
   credentials can be provided upon request to martt8@bfh.ch.

4. **Start the development server**
```bash
   npm run dev
```

   Open http://localhost:3000

5. **Production build**
```bash
   npm run build
   npm start
```

### Scrapers (optional)

Scrapers populate the Supabase database. They are not required to run the web app —
the web app reads existing data from Supabase.

**Puppeteer scrapers (TypeScript)**

Run all Puppeteer scrapers in parallel:
```bash
npm run scrape:all
```

**ScrapeGraphAI scrapers (Python)**

```bash
cd scraping/scrapegraphai
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate        # macOS/Linux
pip install -r requirements.txt
python run_all_scrapers.py
```

**Bright Data scrapers (Python)**

```bash
cd scraping/brightdata
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python run_all_brightdata.py
```

**Self-Healing Loop**

```bash
cd scraping/self-healing
python self_healing_loop.py
```

---

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run test` | Run Jest tests |
| `npm run scrape:all` | Run all Puppeteer scrapers in parallel |
| `npm run generate` | Regenerate Supabase TypeScript types |

---

## Key Features

### Multi-Criteria Decision Analysis (MCDA)

Users define their own weighting on the `/nutzwertanalyse` page across six criteria:

1. Price-performance ratio
2. Teaching quality
3. Location and accessibility
4. Flexibility (distance learning, catch-up options)
5. Additional services (placement test, essay correction, consultations)
6. Digital learning environment (e-learning platform, online materials)

Weightings are passed via URL parameters (`/?w=20,15,15,15,20,15`) — the homepage
recalculates scores in real time on the server. This makes results shareable and
reproducible.

### Dynamic ZAP Information

The `/zap-info` page reads exam dates, registration deadlines, and exam structure
from the `zap_info` Supabase table. Each entry includes:

- Source URL (link to the official zh.ch page)
- `last_verified_at` timestamp
- `updated_by` flag (`manual` or `scraper:zh.ch`)

Currently the table is populated manually with verified zh.ch data. A scraper for
zh.ch is defined as Future Work.

### AI Self-Healing Loop

The `scraping/self-healing/` module runs nightly. When a ScrapeGraphAI run fails:

1. The error is logged in the `scrape_errors` table along with the first 4,000 chars
   of HTML.
2. The HTML and a natural-language repair prompt are sent to Gemini 2.5 Flash.
3. The model returns updated CSS selectors as JSON.
4. The provider config is updated and the scrape is retried automatically.

---

## Documentation

- `docs/report.sql` — Aggregated SQL queries for the thesis evaluation
- `scraping/README.md` — Internal scraper documentation

---

## Author

**Tami**
Bern University of Applied Sciences (BFH) — Department of Business
BSc Business Information Technology
Email: martt8@bfh.ch

---

## Security & Data Handling

- All credentials are managed via `.env` and excluded from version control via `.gitignore`.
- Python virtual environments (`**/venv/`) are excluded from version control.
- Supabase Row Level Security (RLS) is enabled on all tables; the public anon key
  has read-only access to comparison data.

---

## Future Work

- **zh.ch ZAP scraper** — Automatically refresh the `zap_info` table from official sources
- **User accounts** — Save personal weightings, get notified about new courses
