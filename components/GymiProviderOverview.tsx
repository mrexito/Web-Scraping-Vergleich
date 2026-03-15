'use client';
import React, { useState } from "react";
import type { CourseDetail } from "@/schemas/courseDetailSchema";

export interface RatedGymiProviders {
    id: number;
    provider: string;
    pricePerformance: number;
    quality: number;
    flexibility: number;
    additionalServices: number;
    location: number;
    totalScore: number;
    URL?: string[] | null;
    'E-Learning'?: boolean;
    Aufsatzkorrektur?: boolean;
    Einstufungstest?: boolean;
    'Maximale Anzahl der Teilnehmer'?: string | null;
    rawPrice?: number | string | null;
    kurstyp?: 'langgymi' | 'kurzgymi';
}

interface GymiProviderOverviewProps {
    gymiProviders: RatedGymiProviders[];
    courseDetails: CourseDetail[];
}

interface SelectedProvider extends CourseDetail, RatedGymiProviders {
    'Maximale Anzahl der Teilnehmer'?: string | null;
}

const qualitaetLabel = (q?: number | null) => {
    if (q === 1) return '⭐⭐⭐ Sehr gut';
    if (q === 2) return '⭐⭐ Gut';
    if (q === 3) return '⭐ Befriedigend';
    return 'Nicht verfügbar';
};

const boolLabel = (val?: boolean) => val ? '✅ Ja' : '❌ Nein';

const GymiProviderOverview = ({ gymiProviders, courseDetails }: GymiProviderOverviewProps) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>();

    // Bug-Fix: Lookup via provider.id statt Array-Index
    const toggleModal = (providerId: number, state: boolean) => {
        const selected = gymiProviders.find((p) => p.id === providerId);
        if (!selected) {
            console.error('Anbieter nicht gefunden:', providerId);
            return;
        }
        const courseDetail = courseDetails.find((detail) => detail.ID === selected.id);
        if (!courseDetail) {
            console.error('CourseDetail nicht gefunden für:', selected.id);
            return;
        }
        setSelectedProvider({ ...selected, ...courseDetail });
        setShowModal(state);
    };

    return (
        <div>
            <div className="flex min-h-screen flex-col items-start">
                <h1 className="text-3xl flex mt-7">Gymi-Vorbereitungskurs Anbieter</h1>
                <div className="container my-12 mx-auto">
                    <div className="flex flex-wrap -mx-1 lg:-mx-4">
                        {gymiProviders && gymiProviders.map((provider) => {
                            const courseDetail = courseDetails.find((detail) => detail.ID === provider.id);
                            return (
                                <div className="my-1 px-1 w-full md:w-1/2 lg:my-4 lg:px-4 lg:w-1/3" key={provider.id}>
                                    <article className="overflow-hidden rounded-lg shadow-lg">
                                        <header className="flex items-center justify-between leading-tight p-4 bg-gray-50 border-b border-gray-200">
                                            <h1 className="text-lg font-semibold">{provider.provider || 'Name nicht verfügbar'}</h1>
                                            <span className="text-sm font-bold text-gray-600">Score: {provider.totalScore}</span>
                                        </header>

                                        <div className="p-4 flex flex-col gap-2 text-sm">
                                            <p>
                                                <span className="font-medium">Preis:</span>{' '}
                                                {provider.rawPrice && provider.rawPrice !== 'Nicht verfügbar'
                                                    ? 'CHF ' + provider.rawPrice
                                                    : 'Nicht verfügbar'}
                                            </p>
                                            <p><span className="font-medium">Qualität:</span> {qualitaetLabel(courseDetail?.Qualitaetsbewertung)}</p>
                                            <p><span className="font-medium">Unterrichtstag:</span> {courseDetail?.Unterrichttag || 'Nicht verfügbar'}</p>
                                            <p><span className="font-medium">Zusatzleistungen:</span> {boolLabel(provider['E-Learning'])} E-Learning, {boolLabel(provider.Aufsatzkorrektur)} Aufsatzkorrektur</p>
                                            <p><span className="font-medium">Standort:</span> {courseDetail?.Standort || 'Nicht verfügbar'}</p>
                                        </div>

                                        <footer className="flex items-center justify-end p-4 border-t border-gray-200">
                                            <button
                                                className="bg-gray-700 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow hover:bg-gray-800"
                                                type="button"
                                                onClick={() => toggleModal(provider.id, true)}
                                            >
                                                Mehr Informationen
                                            </button>
                                        </footer>
                                    </article>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal — ausserhalb der map(), nur einmal gerendert */}
            {showModal && selectedProvider && (
                <div>
                    <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                        <div className="relative w-auto my-6 mx-auto max-w-lg w-full">
                            <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">

                                <div className="flex items-start justify-between p-5 border-b border-solid rounded-t">
                                    <h3 className="text-2xl font-semibold">{selectedProvider.provider}</h3>
                                    <button
                                        className="p-1 ml-auto bg-transparent border-0 text-black text-3xl leading-none font-semibold outline-none focus:outline-none"
                                        onClick={() => setShowModal(false)}
                                    >
                                        <span className="text-black h-6 w-6 text-2xl block outline-none focus:outline-none">x</span>
                                    </button>
                                </div>

                                <div className="relative p-6 flex flex-col gap-3 text-sm overflow-y-auto max-h-[60vh]">
                                    <h4 className="font-semibold text-base text-gray-700 mb-1">Kursdetails</h4>
                                    <p><span className="font-medium">Kursart:</span> {selectedProvider['Kursart (Intensiv- oder Langzeitkurs)'] || 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Unterrichtstag:</span> {selectedProvider.Unterrichttag || 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Standort:</span> {selectedProvider.Standort || 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Max. Teilnehmer:</span> {selectedProvider['Maximale Anzahl der Teilnehmer'] || 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Kursdauer (Langzeit):</span> {selectedProvider['Dauer der Kurse in Wochen Langzeitkurs'] ? selectedProvider['Dauer der Kurse in Wochen Langzeitkurs'] + ' Wochen' : 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Kursdauer (Kurzzeit):</span> {selectedProvider['Dauer der Kurse in Std. Kurzzeitkurs'] ? selectedProvider['Dauer der Kurse in Std. Kurzzeitkurs'] + ' Std.' : 'Nicht verfügbar'}</p>
                                    <p><span className="font-medium">Qualitätsbewertung:</span> {qualitaetLabel(selectedProvider.Qualitaetsbewertung)}</p>

                                    <h4 className="font-semibold text-base text-gray-700 mt-2 mb-1">Zusatzleistungen</h4>
                                    <p><span className="font-medium">E-Learning:</span> {boolLabel(selectedProvider['E-Learning'])}</p>
                                    <p><span className="font-medium">Aufsatzkorrektur:</span> {boolLabel(selectedProvider.Aufsatzkorrektur)}</p>
                                    <p><span className="font-medium">Einstufungstest:</span> {boolLabel(selectedProvider.Einstufungstest)}</p>
                                    <p><span className="font-medium">Eigene Lernunterlagen:</span> {boolLabel(selectedProvider['Eigene Lernunterlagen'])}</p>
                                    <p><span className="font-medium">Nachholmöglichkeiten:</span> {boolLabel(selectedProvider.Nachholmoeglichkeiten)}</p>
                                    <p><span className="font-medium">Prüfungsarchiv:</span> {boolLabel(selectedProvider.Pruefungsarchiv)}</p>
                                    <p><span className="font-medium">Beratungsgespräch:</span> {boolLabel(selectedProvider.Beratungsgespraech)}</p>
                                    <p><span className="font-medium">Support ausserhalb Unterricht:</span> {boolLabel(selectedProvider['Unterstuezung ausserhalb Unterrichtszeit'])}</p>
                                    <p><span className="font-medium">Info freie Plätze:</span> {boolLabel(selectedProvider['info freien Plaetze?'])}</p>
                                    <p><span className="font-medium">Info Erfolgsquote:</span> {boolLabel(selectedProvider['Info zur Erfolgsquote'])}</p>

                                    {selectedProvider.Spezielles && (
                                        <p><span className="font-medium">Spezielles:</span> {selectedProvider.Spezielles}</p>
                                    )}

                                    {selectedProvider.URL && selectedProvider.URL.length > 0 && (
                                        <div className="mt-2">
                                            <p className="font-semibold">Website:</p>
                                            <ul className="list-disc ml-5 mt-1">
                                                {selectedProvider.URL.map((url, i) => (
                                                    <li key={i}>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                            {url}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end p-6 border-t border-solid rounded-b">
                                    <button
                                        className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none"
                                        onClick={() => setShowModal(false)}
                                    >
                                        Schliessen
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                    <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
                </div>
            )}
        </div>
    );
};

export default GymiProviderOverview;