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
}

interface GymiProviderOverviewProps {
    gymiProviders: RatedGymiProviders[];
    courseDetails: CourseDetail[];
}

interface SelectedProvider extends CourseDetail, RatedGymiProviders {}

const GymiProviderOverview = ({ gymiProviders, courseDetails }: GymiProviderOverviewProps) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>();

    const toggleModal = (providerId: number, state: boolean) => {
        if (gymiProviders && gymiProviders[providerId]) {
            const selectedProvider = gymiProviders[providerId];
            const courseDetail = courseDetails.find((detail) => detail.ID === selectedProvider.id);
            if (!courseDetail) {
                console.log('Failed to find corresponding course detail!');
                return;
            }
            setSelectedProvider({ ...selectedProvider, ...courseDetail });
            setShowModal(state);
        } else {
            console.error("Ungültiger Anbieter oder Index");
        }
    };

    return (
        <div>
            <div className="flex min-h-screen flex-col items-start">
                <h1 className="text-3xl flex mt-7">All Gymi Providers</h1>
                <div className="container my-12 mx-auto">
                    <div className="flex flex-wrap -mx-1 lg:-mx-4">
                        {gymiProviders && gymiProviders.map((provider, index: number) => {
                            const courseDetail = courseDetails.find((detail) => detail.ID === provider.id);
                            return (
                                <div className="my-1 px-1 w-full md:w-1/2 lg:my-4 lg:px-4 lg:w-1/3" key={index}>
                                    <article className="overflow-hidden rounded-lg shadow-lg">
                                        <header className="flex items-center justify-between leading-tight p-2 md:p-4">
                                            <h1 className="text-lg">{provider.provider || 'Name nicht verfügbar'}</h1>
                                            <p className="text-grey-darker text-sm">Score: {provider.totalScore}</p>
                                        </header>
                                        <footer className="flex items-center justify-between leading-none p-2 md:p-4">
                                            <button
                                                className="bg-gray-700 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow"
                                                type="button"
                                                onClick={() => toggleModal(index, true)}
                                            >
                                                Mehr Informationen
                                            </button>
                                            <p className="ml-2">
                                                {courseDetail?.Standort || 'Standort nicht verfügbar'}
                                            </p>
                                        </footer>
                                    </article>

                                    {showModal && selectedProvider && (
                                        <div>
                                            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                                                <div className="relative w-auto my-6 mx-auto max-w-md">
                                                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                                                        <div className="flex items-start justify-between p-5 border-b border-solid rounded-t">
                                                            <h3 className="text-3xl font-semibold">Provider</h3>
                                                            <button
                                                                className="p-1 ml-auto bg-transparent border-0 text-black float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                                                                onClick={() => setShowModal(false)}
                                                            >
                                                                <span className="bg-transparent text-black h-6 w-6 text-2xl block outline-none focus:outline-none">x</span>
                                                            </button>
                                                        </div>
                                                        <div className="relative mx-auto w-full">
                                                            <div className="shadow p-4 rounded-lg bg-white">
                                                                <h2 className="font-medium text-lg">{selectedProvider.provider || 'Name nicht verfügbar'}</h2>
                                                                <div className="flex flex-col gap-2 mt-4">
                                                                    <p><span className="font-medium">Preis-Leistungs-Verhältnis:</span> {selectedProvider.pricePerformance || 'Nicht verfügbar'}</p>
                                                                    <p><span className="font-medium">Qualität des Unterrichts:</span> {selectedProvider.quality || 'Nicht verfügbar'}</p>
                                                                    <p><span className="font-medium">Flexibilität:</span> {selectedProvider.flexibility || 'Nicht verfügbar'}</p>
                                                                    <p><span className="font-medium">Zusatzleistungen:</span> {selectedProvider.additionalServices || 'Nicht verfügbar'}</p>
                                                                    <p><span className="font-medium">Standort:</span> {selectedProvider.location || 'Nicht verfügbar'}</p>
                                                                </div>
                                                                {selectedProvider.URL && selectedProvider.URL.length > 0 ? (
                                                                    <div className="mt-4">
                                                                        <p className="font-semibold">Weitere Informationen:</p>
                                                                        <ul className="list-disc ml-5">
                                                                            {selectedProvider.URL.map((url, i) => (
                                                                                <li key={i}>
                                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                                        {url}
                                                                                    </a>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-4">
                                                                        <p className="text-gray-500">Keine URL verfügbar</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-end p-6 border-t border-solid rounded-b">
                                                            <button
                                                                className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none"
                                                                onClick={() => setShowModal(false)}
                                                            >
                                                                SCHLIESSEN
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="opacity-5 fixed inset-0 z-40 bg-black"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GymiProviderOverview;