# Gymi-Vergleich

## Thema der Arbeit
In diesem Projekt wurde eine Webapplikation entwickelt, die es BenutzerInnen ermöglicht, Gymi-Vorbereitungskurse im Kanton Zürich zu vergleichen und zu bewerten. Ziel war es, eine benutzerfreundliche Plattform zu schaffen, die Schülern und Eltern hilft, den für sie besten Vorbereitungskurs zu finden, indem die Kurse anhand verschiedener Kriterien bewertet werden. Dabei konnten die BenutzerInnen die Gewichtung der Bewertungskriterien individuell anpassen, um eine personalisierte Bewertung zu erhalten.

Die Applikation wurde mithilfe von Next.js für das Frontend und Supabase für das Backend umgesetzt. Für die Gestaltung der Benutzeroberfläche wurde Tailwind CSS verwendet.

Mit Puppeteer wurde ein Web Scraping-Tool entwickelt, das automatisch die Daten von den Webseiten der Gymi-Vorbereitungskurse extrahiert und in der Supabase-Datenbank speichert. 


## Lokal ausführen
1. Repository klonen: git clone https://github.com/TamStefBFH/tamStefBFH-crowdfunding-comparison.git
2. Downlowad node.js 
3. Abhängigkeiten installieren: npm install
5. Web-Scraping ausführen:
   - tsc --build --clean (entfernt alte Build-Dateien und stellt sicher, dass alle Dateien frisch kompiliert werden.)
   - tsc (kompiliert alle TypeScript-Dateien zu JavaScript.)
   - node dist/app/scraping/scraper.js (führt das kompilierte JavaScript-Scraping-Skript aus.)
6. Webapplikation starten: npm run dev
7. Anwendung unter http://localhost:3000 testen

