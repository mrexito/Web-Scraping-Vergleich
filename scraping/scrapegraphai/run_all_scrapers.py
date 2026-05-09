import subprocess
import sys

scrapers = [
    "sGAI_gymivorbereitungZuerichScraper.py",
    "sGAI_avidiiScraper.py",
]

processes = []
for scraper in scrapers:
    print(f"Starte {scraper}...")
    p = subprocess.Popen([sys.executable, scraper])
    processes.append((scraper, p))

for scraper, p in processes:
    p.wait()
    print(f"✓ {scraper} abgeschlossen (exit code: {p.returncode})")

print("\nAlle ScrapeGraphAI Scraper abgeschlossen!")