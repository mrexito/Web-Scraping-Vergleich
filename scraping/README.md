# Scraping Pipeline

This directory contains the data extraction pipeline for the comparison portal.
It is intentionally separated from the Next.js web application (`/app`) to follow
a clean separation of concerns: web code lives in `app/`, data ingestion lives here.

## Structure
All scrapers write to the same Supabase database. Schemas are validated using Zod
on the web side (`/schemas`) and Pydantic / typing on the Python side, ensuring
end-to-end type consistency.

## Comparative Evaluation

The thesis evaluates the three frameworks across:

| Criterion | Puppeteer | ScrapeGraphAI | Bright Data |
| --- | --- | --- | --- |
| Provider coverage | 5 of 12 | 12 of 12 | 2 of 12 |
| Language | TypeScript | Python | Python |
| Approach | DOM selectors | LLM-driven | Managed proxies |
| Resilience | Manual selector fixes | Self-healing via LLM | Provider-side |

`PRIMARY_SCRAPER_METHOD` in `app/page.tsx` is currently set to `scrapegraphai`
because it is the only method covering all 12 providers, avoiding duplicates in
the UI.

## Self-Healing Loop

The `self-healing/` module monitors `scrape_errors` and uses Gemini 2.5 Flash to
regenerate CSS selectors when a scrape fails. The loop:

1. Detects the error and logs the first 4,000 chars of HTML.
2. Sends HTML + natural-language repair prompt to the LLM.
3. Receives updated selectors as JSON.
4. Updates the provider configuration and retries.

## Running

See the main project `README.md` for setup instructions for each method.

## Environment

All scrapers read credentials from the project root `.env` file. They do not
hardcode any URLs, tokens, or configuration.
