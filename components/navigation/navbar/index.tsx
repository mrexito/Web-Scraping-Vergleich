import React from "react";
import Link from "next/link";

const Navbar = ({ toggle }: { toggle: () => void }) => {
  return (
    <>
      <div className="w-full h-20 bg-white sticky top-0 shadow-md">
        <div className="container mx-auto px-4 h-full">
          <div className="flex justify-between items-center h-full">
            <h1 className="text-xl font-bold">Vergleich Gymi-Vorbereitungskurse</h1>
            <button
              type="button"
              className="inline-flex items-center md:hidden"
              onClick={toggle}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
              >
                <path
                  fill="#313638"
                  d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"
                />
              </svg>
            </button>
            {/* Entfernen Sie hier die Nutzwertanalyse aus dem Menü */}
            <ul className="hidden md:flex gap-x-20 text-cr-darkgrey">
              {/* Entfernen Sie den Menüpunkt, wenn Sie ihn nicht anzeigen möchten */}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
