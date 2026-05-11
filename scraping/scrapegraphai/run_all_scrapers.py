"""
run_all_scrapers.py
====================
Startet alle ScrapeGraphAI-Scraper parallel.

Verwendung:
  python run_all_scrapers.py
"""
import subprocess
import sys

# Alle 12 ScrapeGraphAI-Scraper (vollständige Provider-Coverage)
scrapers = [
    "sGAI_avidiiScraper.py",
    "sGAI_gymivorbereitungFokusScraper.py",
    "sGAI_gymivorbereitungZuerichScraper.py",
    "sGAI_learningCubeScraper.py",
    "sGAI_learningCultureScraper.py",
    "sGAI_lernForumScraper.py",
    "sGAI_lernTerrasseScraper.py",
    "sGAI_logosLehrerteamScraper.py",
    "sGAI_nachhilfeAkademieScraper.py",
    "sGAI_openLearningSpaceScraper.py",
    "sGAI_schlaumacherScraper.py",
    "sGAI_schuleZuerichNordScraper.py",
]

processes = []
for scraper in scrapers:
    print(f"Starte {scraper}...")
    p = subprocess.Popen([sys.executable, scraper])
    processes.append((scraper, p))

for scraper, p in processes:
    p.wait()
    print(f"✓ {scraper} abgeschlossen (exit code: {p.returncode})")

print(f"\nAlle {len(scrapers)} ScrapeGraphAI Scraper abgeschlossen!")