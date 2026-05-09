"""
registry_helpers.py
====================
Lese- und Schreibe-Funktionen für die scraper_registry-Tabelle.

Diese Funktionen werden von BEIDEN Seiten genutzt:
  - Self-Healing-Loop: schreibt neue Selectors/Prompts hinein
  - Scraper (Puppeteer/SGI): liest aktuelle Selectors/Prompts beim Start

Das ist die Schnittstelle zwischen "Self-Healing" und "Scraping" — sobald
der Loop einen neuen Selector schreibt, nutzt ihn der nächste Scraper-Lauf.
"""

import os
import sys
from typing import Optional

# Wir nutzen den supabase-Client aus scrape_utils.py (selbe wie SGI)
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapeGraphAi"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import supabase


# =====================================================================
# READ: Aktuellen Wert holen
# =====================================================================
def get_current_value(provider_id: int, scraper_method: str, field_name: str) -> Optional[str]:
    """Lädt den aktuellen Selector/Prompt aus der Registry.

    Args:
        provider_id: z.B. 3 (Avidii)
        scraper_method: 'puppeteer' oder 'scrapegraphai'
        field_name: z.B. 'price_container' oder 'main_prompt'

    Returns:
        Den aktuellen Wert als String, oder None wenn kein Eintrag existiert.
    """
    try:
        result = supabase.table("scraper_registry") \
            .select("current_value") \
            .eq("provider_id", provider_id) \
            .eq("scraper_method", scraper_method) \
            .eq("field_name", field_name) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["current_value"]
        return None
    except Exception as e:
        print(f"  ✗ Fehler beim Lesen aus scraper_registry: {e}")
        return None


# =====================================================================
# READ: Fallback-Wert holen (falls Self-Healing zurückgerollt werden muss)
# =====================================================================
def get_fallback_value(provider_id: int, scraper_method: str, field_name: str) -> Optional[str]:
    """Lädt den Fallback-Wert (Original) aus der Registry."""
    try:
        result = supabase.table("scraper_registry") \
            .select("fallback_value") \
            .eq("provider_id", provider_id) \
            .eq("scraper_method", scraper_method) \
            .eq("field_name", field_name) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["fallback_value"]
        return None
    except Exception as e:
        print(f"  ✗ Fehler beim Lesen aus scraper_registry: {e}")
        return None


# =====================================================================
# WRITE: Neuen Wert setzen (vom Self-Healing-Loop)
# =====================================================================
def update_value_from_self_healing(
    provider_id: int,
    scraper_method: str,
    field_name: str,
    new_value: str,
    notes: Optional[str] = None,
) -> bool:
    """Schreibt einen neuen Selector/Prompt in die Registry.

    Wird vom Self-Healing-Loop aufgerufen, wenn Gemini einen Vorschlag macht.

    Args:
        provider_id, scraper_method, field_name: Identifizieren den Eintrag
        new_value: Der neue Wert (Selector / Prompt)
        notes: Optionale Notiz (z.B. "Gemini hat .pricing-box → .price-info ersetzt")

    Returns:
        True wenn Update erfolgreich, sonst False.
    """
    try:
        # Update bestehenden Eintrag
        result = supabase.table("scraper_registry") \
            .update({
                "current_value": new_value,
                "last_updated_by": "self_healing_loop",
                "last_updated_at": "now()",
                "notes": notes,
            }) \
            .eq("provider_id", provider_id) \
            .eq("scraper_method", scraper_method) \
            .eq("field_name", field_name) \
            .execute()

        if result.data and len(result.data) > 0:
            return True

        # Falls kein Eintrag existiert, neu anlegen (mit Wert als Fallback)
        supabase.table("scraper_registry") \
            .insert({
                "provider_id": provider_id,
                "scraper_method": scraper_method,
                "field_name": field_name,
                "current_value": new_value,
                "fallback_value": new_value,  # Erster Wert ist gleichzeitig Fallback
                "last_updated_by": "self_healing_loop",
                "notes": notes,
            }) \
            .execute()
        return True

    except Exception as e:
        print(f"  ✗ Fehler beim Schreiben in scraper_registry: {e}")
        return False


# =====================================================================
# READ: Alle Einträge eines Providers (für Scraper beim Start)
# =====================================================================
def get_all_for_provider(provider_id: int, scraper_method: str) -> dict:
    """Lädt alle Selectors/Prompts eines Providers als Dict.

    Beispiel-Rückgabe für Avidii (Puppeteer):
        {
          "price_container": ".pricing-box",
          "course_list": ".course-list-item",
          ...
        }

    Args:
        provider_id, scraper_method: Identifizieren den Provider und die Methode

    Returns:
        Dict mit field_name → current_value. Leer falls keine Einträge.
    """
    try:
        result = supabase.table("scraper_registry") \
            .select("field_name, current_value") \
            .eq("provider_id", provider_id) \
            .eq("scraper_method", scraper_method) \
            .execute()

        return {row["field_name"]: row["current_value"] for row in (result.data or [])}
    except Exception as e:
        print(f"  ✗ Fehler beim Laden der Registry für Provider {provider_id}: {e}")
        return {}