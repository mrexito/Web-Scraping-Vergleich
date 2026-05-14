/**
 * compareStore.ts
 * ================
 * Zustand-Store für die Anbieter-Vergleichsfunktion.
 *
 * Funktionalität:
 *   - Bis zu 3 Anbieter zum direkten Vergleich vormerken
 *   - Persistenz im localStorage (überlebt Browser-Refresh)
 *   - Toggle-Logik (hinzufügen/entfernen)
 *
 * Architektur-Entscheidung (DSR-Iteration 4):
 *   Die zentrale Zustandshaltung erfolgt über Zustand statt Context-API,
 *   weil Zustand boilerplate-arm ist, automatische Persistenz mitliefert
 *   und keine Provider-Wrapper im Component-Tree erfordert.
 *
 *   Globaler Compare-State eignet sich für Zustand, weil er
 *   seitenübergreifend (ProviderCard, Header, /compare-Seite) genutzt wird.
 *   Im Gegensatz dazu bleibt die Slider-Konfiguration der Nutzwertanalyse
 *   weiterhin URL-basiert (siehe Kapitel 5.4), da sie teilbar sein muss.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';

// =====================================================================
// TYPES
// =====================================================================

interface CompareState {
  /** IDs der zum Vergleich vorgemerkten Anbieter (max. 3) */
  selectedProviderIds: string[];

  /** Toggle: fügt Provider hinzu oder entfernt ihn */
  toggleProvider: (providerId: string) => void;

  /** Entfernt einen spezifischen Provider aus der Auswahl */
  removeProvider: (providerId: string) => void;

  /** Leert die gesamte Auswahl */
  clearAll: () => void;

  /** Prüft ob ein Provider in der Auswahl ist */
  isSelected: (providerId: string) => boolean;

  /** Anzahl der aktuell ausgewählten Provider */
  count: () => number;

  /** Prüft ob das Maximum erreicht ist (max. 3) */
  isFull: () => boolean;
}

// =====================================================================
// KONFIGURATION
// =====================================================================

const MAX_COMPARE_PROVIDERS = 3;
const STORAGE_KEY = 'gymi-compare-store';

// =====================================================================
// STORE
// =====================================================================

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      selectedProviderIds: [],

      toggleProvider: (providerId: string) =>
        set((state) => {
          const isInList = state.selectedProviderIds.includes(providerId);

          if (isInList) {
            return {
              selectedProviderIds: state.selectedProviderIds.filter(
                (id) => id !== providerId,
              ),
            };
          }

          // Maximum erreicht: nichts hinzufügen
          if (state.selectedProviderIds.length >= MAX_COMPARE_PROVIDERS) {
            return state;
          }

          return {
            selectedProviderIds: [...state.selectedProviderIds, providerId],
          };
        }),

      removeProvider: (providerId: string) =>
        set((state) => ({
          selectedProviderIds: state.selectedProviderIds.filter(
            (id) => id !== providerId,
          ),
        })),

      clearAll: () => set({selectedProviderIds: []}),

      isSelected: (providerId: string) =>
        get().selectedProviderIds.includes(providerId),

      count: () => get().selectedProviderIds.length,

      isFull: () =>
        get().selectedProviderIds.length >= MAX_COMPARE_PROVIDERS,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Nur die IDs persistieren, nicht die Methoden
      partialize: (state) => ({
        selectedProviderIds: state.selectedProviderIds,
      }),
    },
  ),
);