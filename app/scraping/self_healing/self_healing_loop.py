"""
self_healing_loop.py
=====================
Bachelor-Thesis: AI-basierter Self-Healing-Loop

ANFORDERUNG (Anforderung 10 der Thesis):
  "AI self-healing loop (runs every night)
   Example: Migros changed their price class from .price--final → .price-final
   Output: Error detected at 02:03 → AI generated new selector → fixed at 02:07"

ABLAUF (5 Schritte aus Dozenten-Spec):
  1. DETECT   → liest offene Fehler aus scrape_errors (fixed_by_ai IS NULL/false)
  2. ANALYZE  → schickt HTML-Snapshot + Fehler-Kontext an Gemini 2.5 Flash
  3. SUGGEST  → Gemini schlägt neuen Selector (Puppeteer) oder Prompt (SGI) vor
  4. APPLY    → schreibt Vorschlag in scraper_registry → wirkt beim nächsten Scrape
  5. MARK     → setzt scrape_errors.fixed_by_ai = true, ai_suggested_selector = ...

Verwendung:
  python self_healing_loop.py              # alle offenen Fehler bearbeiten
  python self_healing_loop.py --limit 5    # nur die letzten 5
  python self_healing_loop.py --dry-run    # nur anzeigen, nicht schreiben
"""

import os
import sys
import argparse
import time
from datetime import datetime, timezone

# scrape_utils Pfad einbinden
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapeGraphAi"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import supabase
from llm_provider import LLMProvider
from registry_helpers import (
    get_current_value,
    update_value_from_self_healing,
)


# =====================================================================
# KONFIGURATION
# =====================================================================
# Mapping von error_type → (scraper_method, field_name in registry)
# Damit der Loop weiss, was er heilen soll, wenn ein bestimmter Fehler auftritt.
ERROR_TYPE_MAPPING = {
    # Puppeteer-Fehler
    "PRICE_SELECTOR_FAILED":     ("puppeteer", "price_container"),
    "DATE_SELECTOR_FAILED":      ("puppeteer", "date_container"),
    "COURSEDETAILS_ERROR":       ("puppeteer", "courses_list"),

    # ScrapeGraphAI-Fehler
    "NO_COURSES_FOUND":          ("scrapegraphai", "main_prompt"),
    "JSON_PARSE_ERROR":          ("scrapegraphai", "main_prompt"),
    "LLM_HALLUCINATION":         ("scrapegraphai", "main_prompt"),
    "SCRAPING_ERROR":            ("scrapegraphai", "main_prompt"),  # generischer SGI-Fehler
    "MISSING_FIELD":             ("scrapegraphai", "main_prompt"),  # Felder fehlen → Prompt anpassen
}


# =====================================================================
# STEP 1: DETECT — offene Fehler holen
# =====================================================================
def detect_open_errors(limit: int = 20) -> list:
    """Liest offene (nicht-gefixte) Fehler aus scrape_errors.

    Args:
        limit: max. Anzahl Fehler pro Lauf (verhindert Token-Explosion)

    Returns:
        Liste von Error-Dicts mit allen Spalten + provider_name (joined).
    """
    print(f"📥 STEP 1: DETECT — suche offene Fehler (max {limit})...")

    result = supabase.table("scrape_errors") \
        .select("id, run_id, provider_id, error_type, message, html_snapshot, created_at") \
        .or_("fixed_by_ai.is.null,fixed_by_ai.eq.false") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    errors = result.data or []

    # Provider-Namen dazumappen
    provider_ids = list({e["provider_id"] for e in errors if e["provider_id"]})
    if provider_ids:
        providers_result = supabase.table("GymiProviders") \
            .select("ID, Name") \
            .in_("ID", provider_ids) \
            .execute()
        provider_names = {p["ID"]: p["Name"] for p in (providers_result.data or [])}
        for e in errors:
            e["provider_name"] = provider_names.get(e["provider_id"], "Unbekannt")
    else:
        for e in errors:
            e["provider_name"] = "Unbekannt"

    print(f"   → {len(errors)} offene Fehler gefunden")
    return errors


# =====================================================================
# STEPS 2+3: ANALYZE + SUGGEST — Gemini fragen
# =====================================================================
def analyze_and_suggest(error: dict, llm: LLMProvider) -> tuple[str, str, str]:
    """Bestimmt scraper_method/field, lädt alten Wert, fragt Gemini.

    Returns:
        (scraper_method, field_name, new_value) oder (None, None, None) wenn nicht heilbar.
    """
    error_type = error.get("error_type", "")
    provider_id = error.get("provider_id")
    provider_name = error.get("provider_name", "Unbekannt")

    # 1. Mapping bestimmen
    if error_type not in ERROR_TYPE_MAPPING:
        print(f"   ⚠ error_type '{error_type}' nicht im Mapping — übersprungen")
        return (None, None, None)

    scraper_method, field_name = ERROR_TYPE_MAPPING[error_type]
    print(f"   📋 Heile: {scraper_method}.{field_name} für {provider_name}")

    # 2. Alten Wert aus Registry laden
    old_value = get_current_value(provider_id, scraper_method, field_name)
    if not old_value:
        # Kein Registry-Eintrag → Auto-Create-Modus.
        # Gemini bekommt einen leeren alten Wert und schlägt von Grund auf vor.
        # Der Vorschlag wird dann als Initial-Eintrag in der Registry angelegt.
        print(f"   ℹ Kein Registry-Eintrag — Auto-Create-Modus aktiv")
        old_value = "(noch nicht definiert — bitte Vorschlag von Grund auf erstellen)"

    # 3. Gemini fragen
    print(f"   🧠 Frage Gemini an ({len(error.get('html_snapshot') or '')} Bytes HTML)...")

    if scraper_method == "puppeteer":
        new_value = llm.suggest_selector(
            provider_name=provider_name,
            field_name=field_name,
            old_selector=old_value,
            html_snapshot=error.get("html_snapshot") or "",
            error_message=error.get("message", ""),
        )
    elif scraper_method == "scrapegraphai":
        new_value = llm.suggest_prompt(
            provider_name=provider_name,
            field_name=field_name,
            old_prompt=old_value,
            html_snapshot=error.get("html_snapshot") or "",
            error_message=error.get("message", ""),
        )
    else:
        new_value = None

    if not new_value:
        print(f"   ⚠ Gemini hat keinen Vorschlag")
        return (None, None, None)

    # Selector/Prompt darf nicht gleich dem alten sein
    if new_value.strip() == old_value.strip():
        print(f"   ⚠ Gemini schlägt denselben Wert vor — kein Fix nötig")
        return (None, None, None)

    print(f"   ✓ Vorschlag von Gemini: {new_value[:80]}{'...' if len(new_value) > 80 else ''}")
    return (scraper_method, field_name, new_value)


# =====================================================================
# STEP 4: APPLY — in Registry schreiben
# =====================================================================
def apply_fix(
    provider_id: int,
    scraper_method: str,
    field_name: str,
    new_value: str,
    error_id: str,
    dry_run: bool = False,
) -> bool:
    """Schreibt den neuen Wert in scraper_registry.

    Args:
        dry_run: Wenn True, wird nichts in die DB geschrieben (nur ausgegeben)
    """
    notes = f"Self-Healing: ersetzt durch Gemini am {datetime.now(timezone.utc).isoformat()}. Error-ID: {error_id}"

    if dry_run:
        print(f"   [DRY-RUN] würde update_value_from_self_healing aufrufen")
        return True

    success = update_value_from_self_healing(
        provider_id=provider_id,
        scraper_method=scraper_method,
        field_name=field_name,
        new_value=new_value,
        notes=notes,
    )
    if success:
        print(f"   ✓ scraper_registry aktualisiert")
    else:
        print(f"   ✗ scraper_registry-Update fehlgeschlagen")
    return success


# =====================================================================
# STEP 5: MARK — Fehler als fixed markieren
# =====================================================================
def mark_error_as_fixed(error_id: str, suggested_value: str, dry_run: bool = False):
    """Markiert den Fehler in scrape_errors als von AI gefixt."""
    if dry_run:
        print(f"   [DRY-RUN] würde scrape_errors.fixed_by_ai = true setzen")
        return

    try:
        supabase.table("scrape_errors") \
            .update({
                "fixed_by_ai": True,
                "fixed_at": datetime.now(timezone.utc).isoformat(),
                "ai_suggested_selector": suggested_value,
            }) \
            .eq("id", error_id) \
            .execute()
        print(f"   ✓ scrape_errors.fixed_by_ai = true")
    except Exception as e:
        print(f"   ✗ Konnte scrape_errors nicht markieren: {e}")


# =====================================================================
# MAIN — die ganze Pipeline
# =====================================================================
def run(limit: int = 20, dry_run: bool = False):
    """Hauptfunktion: alle 5 Schritte für jeden offenen Fehler durchgehen."""
    print("=" * 70)
    print(f"🤖 SELF-HEALING-LOOP gestartet — {datetime.now().isoformat(timespec='seconds')}")
    if dry_run:
        print("   ℹ️  DRY-RUN-Modus aktiv (es wird nichts in die DB geschrieben)")
    print("=" * 70)

    # LLM einmalig initialisieren
    try:
        llm = LLMProvider()
    except Exception as e:
        print(f"\n✗ LLM-Provider konnte nicht initialisiert werden: {e}")
        return

    # STEP 1: Fehler holen
    errors = detect_open_errors(limit=limit)

    if not errors:
        print("\n✓ Keine offenen Fehler — nichts zu heilen.")
        return

    # Counter für Endbericht
    healed = 0
    skipped = 0
    failed = 0

    for i, error in enumerate(errors, 1):
        print(f"\n┌─ Fehler {i}/{len(errors)} ──────────────────────────────────────")
        print(f"│ ID:           {error['id']}")
        print(f"│ Provider:     {error.get('provider_name')} (ID {error.get('provider_id')})")
        print(f"│ error_type:   {error.get('error_type')}")
        print(f"│ Nachricht:    {(error.get('message') or '')[:80]}")
        print(f"│ Erkannt:      {error.get('created_at')}")
        print(f"└─────────────────────────────────────────────────────────────")

        # STEPS 2+3
        scraper_method, field_name, new_value = analyze_and_suggest(error, llm)

        if not new_value:
            skipped += 1
            continue

        # STEP 4
        applied = apply_fix(
            provider_id=error["provider_id"],
            scraper_method=scraper_method,
            field_name=field_name,
            new_value=new_value,
            error_id=error["id"],
            dry_run=dry_run,
        )

        if not applied:
            failed += 1
            continue

        # STEP 5
        mark_error_as_fixed(error_id=error["id"], suggested_value=new_value, dry_run=dry_run)
        healed += 1

    # Bericht
    print("\n" + "=" * 70)
    print(f"🤖 SELF-HEALING-LOOP beendet")
    print(f"   ✓ Geheilt:     {healed}")
    print(f"   ⚠ Übersprungen: {skipped}")
    print(f"   ✗ Fehlgeschlagen: {failed}")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Self-Healing-Loop für scrape_errors")
    parser.add_argument("--limit", type=int, default=20,
                        help="Max. Anzahl Fehler pro Lauf (default: 20)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Nur anzeigen, nichts in DB schreiben")
    args = parser.parse_args()

    run(limit=args.limit, dry_run=args.dry_run)