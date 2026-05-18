"""
llm_provider.py
================
Abstrahiert den LLM-Zugriff für den Self-Healing-Loop.
Aktuell: Gemini 2.5 Flash via google-genai SDK.
Austauschbar gegen BFH LLM, falls erforderlich.

Diese Klasse hat zwei Methoden:
  - suggest_selector(): vorschlag für CSS-Selektor (Puppeteer-Heilung)
  - suggest_prompt(): vorschlag für angepassten Prompt (SGI-Heilung)
"""

import os
import time
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError

load_dotenv()


class LLMProvider:
    """Wrapper um Gemini 2.5 Flash. Mit automatischem Retry bei Rate-Limits."""

    MODEL = "gemini-2.5-flash"
    MAX_RETRIES = 3
    RETRY_DELAY_S = 30  # bei 503/429 warten

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY fehlt in .env")
        self.client = genai.Client(api_key=api_key)

    # =================================================================
    # PUPPETEER: Selektor heilen
    # =================================================================
    def suggest_selector(
        self,
        provider_name: str,
        field_name: str,
        old_selector: str,
        html_snapshot: str,
        error_message: str,
    ) -> Optional[str]:
        """Schlägt einen neuen CSS-Selector für das gegebene Feld vor.

        Args:
            provider_name: z.B. "Avidii"
            field_name: z.B. "price_container"
            old_selector: alter Selector, der nicht mehr funktioniert
            html_snapshot: HTML-Auszug der aktuellen Seite (max 50KB)
            error_message: Fehlermeldung des Scrapers

        Returns:
            Neuen CSS-Selector als String, oder None wenn AI keinen findet.
        """
        # HTML auf 50KB begrenzen, um Tokens zu sparen
        html_snippet = html_snapshot[:50000] if html_snapshot else "(kein HTML-Snapshot vorhanden)"

        prompt = f"""Du bist ein Experte für Web-Scraping mit Puppeteer.
Ein CSS-Selektor funktioniert nicht mehr, weil sich die Webseite geändert hat.

KONTEXT:
- Anbieter: {provider_name}
- Feld: {field_name}
- Alter Selektor (funktioniert NICHT mehr): {old_selector}
- Fehlermeldung: {error_message}

AKTUELLES HTML (Auszug):
```html
{html_snippet}
```

AUFGABE:
Analysiere das HTML und schlage einen NEUEN CSS-Selektor vor, der das Feld
"{field_name}" zuverlässig findet. Der Selektor muss:
1. Syntaktisch valides CSS sein
2. So spezifisch wie nötig, so generisch wie möglich
3. Idealerweise robust gegen kleine HTML-Änderungen (z.B. Klassen-IDs vermeiden)

ANTWORT-FORMAT:
Gib NUR den neuen Selector zurück, ohne Erklärung, ohne Markdown, ohne Anführungszeichen.
Beispiel: .product-price
Wenn du keinen passenden Selector findest, antworte exakt: NO_SUGGESTION
"""

        return self._generate_with_retry(prompt)

    # =================================================================
    # SCRAPEGRAPHAI: Prompt heilen
    # =================================================================
    def suggest_prompt(
        self,
        provider_name: str,
        field_name: str,
        old_prompt: str,
        html_snapshot: str,
        error_message: str,
    ) -> Optional[str]:
        """Schlägt einen verbesserten ScrapeGraphAI-Prompt vor.

        Unterstützt zwei Patterns:
          - Legacy 'main_prompt': old_prompt ist ein einfacher String.
            Gemini liefert einen verbesserten String.
          - Standard 'prompts': old_prompt ist ein JSON-Objekt (String-repr.)
            mit Sub-Prompts (z.B. {"overview": "...", "courses": "..."}).
            Gemini liefert das verbesserte JSON-Objekt zurück (gleiche Keys).

        Args:
            provider_name: z.B. "Lern-Forum"
            field_name: "main_prompt" (legacy) oder "prompts" (Welle 1-3)
            old_prompt: alter Wert; bei field_name='prompts' ein JSON-String
            html_snapshot: HTML-Auszug der aktuellen Seite (max 50KB)
            error_message: Fehlermeldung (z.B. "0 Kurse extrahiert")

        Returns:
            Bei 'main_prompt': verbesserter Prompt als String.
            Bei 'prompts': JSON-String mit allen Sub-Prompts (gleiche Keys).
            None wenn AI nichts vorschlagen kann.
        """
        html_snippet = html_snapshot[:50000] if html_snapshot else "(kein HTML-Snapshot vorhanden)"

        # Branchen-Prompt: anderer Output-Hinweis je nach Pattern
        is_json_pattern = (field_name == "prompts")

        if is_json_pattern:
            # 'prompts'-Pattern: Gemini bekommt das alte JSON, soll es als JSON zurückgeben
            format_hint = (
                "Der alte Wert ist ein JSON-Objekt mit Sub-Prompts (z.B. {\"overview\": \"...\", "
                "\"courses\": \"...\"}). Gib ein NEUES JSON-Objekt mit DENSELBEN Keys zurück, "
                "aber mit verbesserten Prompt-Texten als Werten.\n\n"
                "ANTWORT-FORMAT:\n"
                "Gib NUR das JSON zurück, ohne Erklärung, ohne Markdown, ohne Code-Block-Markup.\n"
                "Beispiel: {\"overview\": \"verbesserter Prompt-Text...\", \"courses\": \"...\"}\n"
                "Wenn du keinen besseren Prompt findest, antworte exakt: NO_SUGGESTION"
            )
        else:
            # Legacy 'main_prompt'-Pattern: einfacher String
            format_hint = (
                "ANTWORT-FORMAT:\n"
                "Gib NUR den neuen Prompt zurück, ohne Erklärung, ohne Markdown, ohne Anführungszeichen.\n"
                "Wenn du keinen besseren Prompt findest, antworte exakt: NO_SUGGESTION"
            )

        prompt = f"""Du bist ein Experte für ScrapeGraphAI (LLM-basiertes Web-Scraping).
Ein Scraping-Prompt funktioniert nicht mehr zuverlässig.

KONTEXT:
- Anbieter: {provider_name}
- Feld: {field_name}
- Alter Prompt (funktioniert NICHT mehr): {old_prompt}
- Problem: {error_message}

AKTUELLES HTML (Auszug):
```html
{html_snippet}
```

AUFGABE:
Analysiere das HTML und formuliere einen VERBESSERTEN Prompt für ScrapeGraphAI,
der die Kurs-Daten zuverlässig extrahiert. Der Prompt muss:
1. Klar und spezifisch sein (welche Felder genau)
2. Einen JSON-Array als Output verlangen
3. Edge-Cases adressieren (fehlende Felder, mehrere Kurstypen)
4. Auf die tatsächliche Seitenstruktur eingehen, die du im HTML siehst

{format_hint}
"""

        return self._generate_with_retry(prompt)

    # =================================================================
    # INTERN: Generate mit Retry-Logic
    # =================================================================
    def _generate_with_retry(self, prompt: str) -> Optional[str]:
        """Sendet den Prompt an Gemini, mit Retry bei 503/429."""
        last_error = None
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.MODEL,
                    contents=prompt,
                )
                text = (response.text or "").strip()

                if not text or text == "NO_SUGGESTION":
                    return None

                return text

            except APIError as e:
                last_error = e
                # Bei Rate-Limit (429) oder Server-Fehler (503) warten
                if e.code in (429, 503):
                    if attempt < self.MAX_RETRIES:
                        print(f"  ⏳ Gemini {e.code} — warte {self.RETRY_DELAY_S}s (Versuch {attempt}/{self.MAX_RETRIES})")
                        time.sleep(self.RETRY_DELAY_S)
                        continue
                # Andere Fehler nicht nochmal probieren
                print(f"  ✗ Gemini-Fehler {e.code}: {e}")
                return None

        print(f"  ✗ Gemini nach {self.MAX_RETRIES} Versuchen aufgegeben: {last_error}")
        return None