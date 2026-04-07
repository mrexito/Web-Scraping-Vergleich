export const metadata = {
  title: 'Über uns | Gymi Preparation Course Scoring System',
  description: 'Über das Vergleichsportal für Gymi-Vorbereitungskurse',
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 sm:px-8 py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">Über uns</h1>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Das Projekt</h2>
        <p className="text-gray-600 leading-relaxed">
          Dieses Vergleichsportal wurde im Rahmen einer Bachelorarbeit an der Berner Fachhochschule (BFH) entwickelt. 
          Ziel ist es, Eltern und Schülerinnen und Schüler dabei zu unterstützen, den passenden 
          Gymi-Vorbereitungskurs im Kanton Zürich zu finden.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Wie funktioniert der Vergleich?</h2>
        <p className="text-gray-600 leading-relaxed">
          Das Portal verwendet eine gewichtete Nutzwertanalyse. Nutzerinnen und Nutzer können 
          selbst festlegen, welche Kriterien ihnen besonders wichtig sind — zum Beispiel Preis, 
          Qualität, Flexibilität oder Standort. Basierend auf diesen Gewichtungen werden die 
          Anbieter bewertet und nach Gesamtpunktzahl gerankt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Datenaktualität</h2>
        <p className="text-gray-600 leading-relaxed">
          Die Kursdaten werden automatisch über Web-Scraping von den Websites der Anbieter 
          gesammelt und regelmässig aktualisiert. Alle Preisangaben dienen als Orientierung — 
          massgeblich sind stets die aktuellen Angaben auf den jeweiligen Anbieter-Websites.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Berner Fachhochschule</h2>
        <p className="text-gray-600 leading-relaxed">
          Diese Arbeit entstand im Studiengang Wirtschaftsinformatik an der 
          Berner Fachhochschule (BFH), Departement Wirtschaft.
        </p>
      </section>
    </div>
  );
}