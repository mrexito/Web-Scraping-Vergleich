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
    urlLanggymi?: string | null;
    urlKurzgymi?: string | null;
    verfuegbarkeitLanggymi?: string | null;
    verfuegbarkeitKurzgymi?: string | null;
    Unterrichttag?: string | null;
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

const verfuegbarkeitBadge = (val?: string | null) => {
    if (!val) return null;
    if (val.includes('ausgebucht')) return (
        <span style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>
            Einige ausgebucht
        </span>
    );
    if (val.includes('Wenige')) return (
        <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>
            Wenige Plätze
        </span>
    );
    return (
        <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>
            Viele Plätze
        </span>
    );
};

const CheckIcon = ({ val }: { val?: boolean }) => (
    <span style={{ color: val ? '#0F6E56' : '#A32D2D', fontSize: '14px', fontWeight: 500 }}>
        {val ? '✓' : '✗'}
    </span>
);

const GymiProviderOverview = ({ gymiProviders, courseDetails }: GymiProviderOverviewProps) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>();

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
        // courseDetail zuerst spreaden, dann selected — so überschreibt der dynamische
        // Unterrichttag aus RatedGymiProviders den statischen aus CourseDetail
        setSelectedProvider({ ...courseDetail, ...selected });
        setShowModal(state);
    };

    const verfuegbarkeit = selectedProvider?.kurstyp === 'langgymi'
        ? selectedProvider?.verfuegbarkeitLanggymi
        : selectedProvider?.verfuegbarkeitKurzgymi;

    const anmeldeUrl = selectedProvider?.kurstyp === 'langgymi'
        ? selectedProvider?.urlLanggymi
        : selectedProvider?.urlKurzgymi;

    const anmeldeLabel = selectedProvider?.kurstyp === 'langgymi'
        ? 'Zur Anmeldung Langgymnasium →'
        : 'Zur Anmeldung Kurzgymnasium →';

    return (
        <div>
            <div className="flex min-h-screen flex-col items-start">
                <h1 className="text-3xl flex mt-7">Gymi-Vorbereitungskurs Anbieter</h1>
                <div className="container my-12 mx-auto">
                    <div className="flex flex-wrap -mx-1 lg:-mx-4">
                        {gymiProviders && gymiProviders.map((provider) => {
                            const courseDetail = courseDetails.find((detail) => detail.ID === provider.id);
                            const cardVerfuegbarkeit = provider.kurstyp === 'langgymi'
                                ? provider.verfuegbarkeitLanggymi
                                : provider.verfuegbarkeitKurzgymi;
                            return (
                                <div className="my-1 px-1 w-full md:w-1/2 lg:my-4 lg:px-4 lg:w-1/3" key={provider.id}>
                                    <article className="overflow-hidden rounded-lg shadow-lg">

                                        <header className="flex items-center justify-between leading-tight p-4 bg-gray-50 border-b border-gray-200">
                                            <h1 className="text-lg font-semibold">{provider.provider || 'Name nicht verfügbar'}</h1>
                                            <span className="text-sm font-bold text-gray-600">Score: {provider.totalScore}</span>
                                        </header>

                                        <div className="p-4">
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Preis</p>
                                                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
                                                        {provider.rawPrice && provider.rawPrice !== 'Nicht verfügbar'
                                                            ? (typeof provider.rawPrice === 'string' && provider.rawPrice.startsWith('CHF')
                                                                ? provider.rawPrice
                                                                : 'CHF ' + provider.rawPrice)
                                                            : 'Nicht verfügbar'}
                                                    </p>
                                                </div>
                                                <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Unterrichtstag</p>
                                                    {/* Dynamischer Wert aus courses-Tabelle hat Priorität über statischen CourseDetail-Wert */}
                                                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>
                                                        {provider.Unterrichttag || courseDetail?.Unterrichttag || 'Nicht verfügbar'}
                                                    </p>
                                                </div>
                                                <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Standort</p>
                                                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{courseDetail?.Standort || 'Nicht verfügbar'}</p>
                                                </div>
                                                <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Verfügbarkeit</p>
                                                    {cardVerfuegbarkeit
                                                        ? verfuegbarkeitBadge(cardVerfuegbarkeit)
                                                        : <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>Nicht verfügbar</p>}
                                                </div>
                                            </div>
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

            {showModal && selectedProvider && (
                <div>
                    <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                        <div className="relative w-auto my-6 mx-auto max-w-lg w-full">
                            <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">

                                <div className="flex items-center justify-between p-5 border-b border-solid rounded-t">
                                    <h3 className="text-xl font-semibold">{selectedProvider.provider}</h3>
                                    <button
                                        className="p-1 ml-auto bg-transparent border-0 text-black text-3xl leading-none font-semibold outline-none focus:outline-none"
                                        onClick={() => setShowModal(false)}
                                    >
                                        <span className="text-black h-6 w-6 text-2xl block outline-none focus:outline-none">x</span>
                                    </button>
                                </div>

                                <div className="relative p-6 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">

                                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                        Kursdetails
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Unterrichtstag</p>
                                            <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{selectedProvider.Unterrichttag || 'Nicht verfügbar'}</p>
                                        </div>
                                        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Max. Teilnehmer</p>
                                            <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{selectedProvider['Maximale Anzahl der Teilnehmer'] || 'Nicht verfügbar'}</p>
                                        </div>
                                        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Qualität</p>
                                            <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{qualitaetLabel(selectedProvider.Qualitaetsbewertung)}</p>
                                        </div>
                                        {verfuegbarkeit && (
                                            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Verfügbarkeit</p>
                                                {verfuegbarkeitBadge(verfuegbarkeit)}
                                            </div>
                                        )}
                                    </div>

                                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0' }}>
                                        Zusatzleistungen
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        {[
                                            { label: 'E-Learning', val: selectedProvider['E-Learning'] },
                                            { label: 'Aufsatzkorrektur', val: selectedProvider.Aufsatzkorrektur },
                                            { label: 'Einstufungstest', val: selectedProvider.Einstufungstest },
                                            { label: 'Lernunterlagen', val: selectedProvider['Eigene Lernunterlagen'] },
                                            { label: 'Prüfungsarchiv', val: selectedProvider.Pruefungsarchiv },
                                            { label: 'Beratungsgespräch', val: selectedProvider.Beratungsgespraech },
                                        ].map((item) => (
                                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                                <CheckIcon val={item.val} />
                                                {item.label}
                                            </div>
                                        ))}
                                    </div>

                                    {anmeldeUrl ? (
                                        <a
                                            href={anmeldeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                textAlign: 'center',
                                                background: '#2C2C2A',
                                                color: '#F1EFE8',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                padding: '10px 16px',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                marginTop: '4px',
                                            }}
                                        >
                                            {anmeldeLabel}
                                        </a>
                                    ) : selectedProvider.URL && selectedProvider.URL.length > 0 ? (
                                        <div>
                                            <p className="font-semibold text-sm mb-1">Website:</p>
                                            <ul className="list-disc ml-5">
                                                {selectedProvider.URL.map((url, i) => (
                                                    <li key={i}>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">
                                                            {url}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}

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
