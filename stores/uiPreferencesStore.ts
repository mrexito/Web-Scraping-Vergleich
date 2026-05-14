/**
 * uiPreferencesStore.ts
 * =====================
 * Zustand-Store für persistente UI-Präferenzen des Users.
 *
 * Funktionalität:
 *   - Sort-Reihenfolge (Score / Preis / Name)
 *   - View-Modus (Grid / Liste)
 *   - Persistenz im localStorage (überlebt Browser-Refresh + Sessions)
 *
 * Architektur-Entscheidung (DSR-Iteration 4):
 *   Während die MCDA-Gewichtungen URL-basiert sind (teilbar, server-side),
 *   handelt es sich bei Sort und View-Modus um persönliche UI-Vorlieben,
 *   die nicht geteilt werden müssen, sondern dem User über Sessions
 *   hinweg erhalten bleiben sollen. Zustand mit der persist-Middleware
 *   bietet hierfür die einfachste Implementation.
 *
 *   Dies komplementiert den Compare-Store als zweiten Zustand-Store
 *   im System und realisiert die Topic-Anforderung «Refactor the
 *   technical architecture using the state management tool Zustand».
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';

// =====================================================================
// TYPES
// =====================================================================

export type SortKey = 'score' | 'price' | 'name';
export type ViewMode = 'grid' | 'list';

interface UiPreferencesState {
  /** Aktuelle Sortierung der Anbieter-Liste */
  sort: SortKey;

  /** Aktueller Anzeige-Modus (Grid vs. Listen-Ansicht) */
  view: ViewMode;

  /** Sortierung setzen */
  setSort: (sort: SortKey) => void;

  /** View-Modus setzen */
  setView: (view: ViewMode) => void;
}

// =====================================================================
// KONFIGURATION
// =====================================================================

const STORAGE_KEY = 'gymi-ui-preferences';

const DEFAULT_SORT: SortKey = 'score';
const DEFAULT_VIEW: ViewMode = 'grid';

// =====================================================================
// STORE
// =====================================================================

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      sort: DEFAULT_SORT,
      view: DEFAULT_VIEW,

      setSort: (sort) => set({sort}),
      setView: (view) => set({view}),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);