"""
run_all_brightdata.py
======================
Startet alle Bright Data-Scraper parallel.

Verwendung:
  python run_all_brightdata.py
"""
import subprocess
import sys

# Alle 5 Bright Data-Scraper (deckungsgleich mit Puppeteer für Drei-Wege-Vergleich)
scrapers = [
    "brightdata_avidiiScraper.py",
    "brightdata_gymivorbereitungZuerichScraper.py",
    "brightdata_learningCultureScraper.py",
    "brightdata_lernForumScraper.py",
    "brightdata_nachhilfeAkademieScraper.py",
]

processes = []
for scraper in scrapers:
    print(f"Starte {scraper}...")
    p = subprocess.Popen([sys.executable, scraper])
    processes.append((scraper, p))

for scraper, p in processes:
    p.wait()
    print(f"✓ {scraper} abgeschlossen (exit code: {p.returncode})")

print(f"\nAlle {len(scrapers)} Bright Data Scraper abgeschlossen!")