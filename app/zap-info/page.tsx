export const metadata = {
  title: 'ZAP-Info | Gymi Preparation Course Scoring System',
  description: 'Informationen zur Zentralen Aufnahmeprüfung (ZAP) im Kanton Zürich',
};

export default function ZapInfoPage() {
  return (
    <div className="container mx-auto px-4 sm:px-8 py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-2">ZAP-Info</h1>
      <p className="text-sm text-gray-500 mb-8">
        Zentrale Aufnahmeprüfung (ZAP) — Kanton Zürich
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Was ist die ZAP?</h2>
        <p className="text-gray-600 leading-relaxed">
          Die Zentrale Aufnahmeprüfung (ZAP) ist die Prüfung für den Eintritt ins Gymnasium
          im Kanton Zürich. Sie wird jährlich durchgeführt und prüft die Kenntnisse in
          Mathematik und Deutsch.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Prüfungsfächer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="font-medium mb-1">Mathematik</p>
            <p className="text-sm text-gray-600">Arithmetik, Algebra, Geometrie</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="font-medium mb-1">Deutsch</p>
            <p className="text-sm text-gray-600">Aufsatz, Grammatik, Textverständnis</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Gymnasium-Typen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="font-medium mb-1">Langzeitgymnasium</p>
            <p className="text-sm text-gray-600">
              Eintritt nach der 6. Klasse Primarschule.
              Prüfung jeweils im März.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="font-medium mb-1">Kurzzeitgymnasium</p>
            <p className="text-sm text-gray-600">
              Eintritt nach der 2. Klasse Sekundarschule.
              Prüfung jeweils im März.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Wichtige Links</h2>
        <ul className="space-y-2">
          <li>
            <a
              href="https://www.zh.ch/de/bildung-schule/schulen/mittelschulen/aufnahmepruefungen.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Offizielle ZAP-Seite Kanton Zürich
            </a>
          </li>
          <li>
            <a
              href="https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/bildung-schule/schulen/mittelschulen/aufnahmepruefungen/zap-merkblatt.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Merkblatt zur Aufnahmeprüfung (PDF)
            </a>
          </li>
        </ul>
      </section>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          ⚠️ Diese Informationen werden regelmässig aktualisiert.
          Massgeblich sind stets die offiziellen Angaben des Kantons Zürich.
        </p>
      </div>
    </div>
  );
}
