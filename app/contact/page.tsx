export const metadata = {
  title: 'Kontakt | Gymi Preparation Course Scoring System',
  description: 'Kontakt aufnehmen',
};

export default function KontaktPage() {
  return (
    <div className="container mx-auto px-4 sm:px-8 py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">Kontakt</h1>

      <section className="mb-8">
        <p className="text-gray-600 leading-relaxed mb-6">
          Bei Fragen, Anregungen oder Feedback zum Portal kannst du uns gerne kontaktieren.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Projekt</p>
            <p className="font-medium">Bachelorarbeit – Vergleichsportal Gymi-Vorbereitungskurse</p>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Institution</p>
            <p className="font-medium">Berner Fachhochschule (BFH)</p>
            <p className="text-gray-600">Departement Wirtschaft</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">E-Mail</p>
            <a
              href="mailto:martt8@bfh.ch"
              className="text-blue-600 hover:underline font-medium"
            >
              martt8@bfh.ch
            </a>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-3">Fehler melden</h2>
        <p className="text-gray-600 leading-relaxed">
          Falls du fehlerhafte oder veraltete Daten entdeckst, melde uns dies bitte per E-Mail.
          Wir aktualisieren die Daten so schnell wie möglich.
        </p>
      </section>
    </div>
  );
}
