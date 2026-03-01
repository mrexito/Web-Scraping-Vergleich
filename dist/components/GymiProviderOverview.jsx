"use strict";
'use client';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importStar(require("react"));
var GymiProviderOverview = function (_a) {
    var gymiProviders = _a.gymiProviders, courseDetails = _a.courseDetails;
    var _b = (0, react_1.useState)(false), showModal = _b[0], setShowModal = _b[1];
    var _c = (0, react_1.useState)(), selectedProvider = _c[0], setSelectedProvider = _c[1];
    var toggleModal = function (providerId, state) {
        if (gymiProviders && gymiProviders[providerId]) {
            var selectedProvider_1 = gymiProviders[providerId];
            var courseDetail = courseDetails.find(function (detail) { return detail.ID === selectedProvider_1.id; });
            if (!courseDetail) {
                console.log('Failed to find corresponding course detail!');
                return;
            }
            setSelectedProvider(__assign(__assign({}, selectedProvider_1), courseDetail));
            setShowModal(state);
        }
        else {
            console.error("Ungültiger Anbieter oder Index");
        }
    };
    return (<div>
            <div className="flex min-h-screen flex-col items-start">
                <h1 className="text-3xl flex mt-7">All Gymi Providers</h1>
                <div className="container my-12 mx-auto">
                    <div className="flex flex-wrap -mx-1 lg:-mx-4">
                        {gymiProviders && gymiProviders.map(function (provider, index) {
            var courseDetail = courseDetails.find(function (detail) { return detail.ID === provider.id; });
            return (<div className="my-1 px-1 w-full md:w-1/2 lg:my-4 lg:px-4 lg:w-1/3" key={index}>
                                    <article className="overflow-hidden rounded-lg shadow-lg">
                                        <header className="flex items-center justify-between leading-tight p-2 md:p-4">
                                            <h1 className="text-lg">{provider.provider || 'Name nicht verfügbar'}</h1>
                                            <p className="text-grey-darker text-sm">Score: {provider.totalScore}</p>
                                        </header>

                                        <footer className="flex items-center justify-between leading-none p-2 md:p-4">
                                            <button className="bg-gray-700 text-white font-bold uppercase text-xs px-4 py-2 rounded shadow" type="button" onClick={function () { return toggleModal(index, true); }}>
                                                Mehr Informationen
                                            </button>
                                            <p className="ml-2">
                                                <i className="fi fi-rr-marker mr-2 mb-0"></i>
                                                {(courseDetail === null || courseDetail === void 0 ? void 0 : courseDetail.Standort) || 'Standort nicht verfügbar'}
                                            </p>
                                        </footer>
                                    </article>

                                    {/* MODAL */}
                                    {showModal && selectedProvider ? (<div>
                                            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                                                <div className="relative w-auto my-6 mx-auto max-w-md">
                                                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                                                        <div className="flex items-start justify-between p-5 border-b border-solid border-blueGray-200 rounded-t">
                                                            <h3 className="text-3xl font-semibold">Provider</h3>
                                                            <button className="p-1 ml-auto bg-transparent border-0 text-black float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={function () { return setShowModal(false); }}>
                                                                <span className="bg-transparent text-black h-6 w-6 text-2xl block outline-none focus:outline-none">×</span>
                                                            </button>
                                                        </div>
                                                        <div className="relative mx-auto w-full">
                                                            <div className="shadow p-4 rounded-lg bg-white">
                                                                <h2 className="font-medium text-lg">{selectedProvider.provider || 'Name nicht verfügbar'}</h2>
                                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                                    <p><i className="fi fi-rr-coins mr-2"></i>Preis-Leistungs-Verhältnis: {selectedProvider.pricePerformance || 'Nicht verfügbar'}</p>
                                                                    <p><i className="fi fi-bs-heart mr-2"></i>Qualität des Unterrichts: {selectedProvider.quality || 'Nicht verfügbar'}</p>
                                                                    <p><i className="fi fi-rr-calendar mr-2"></i>Flexibilität: {selectedProvider.flexibility || 'Nicht verfügbar'}</p>
                                                                    <p><i className="fi fi-rr-gift mr-2"></i>Zusatzleistungen: {selectedProvider.additionalServices || 'Nicht verfügbar'}</p>
                                                                    <p><i className="fi fi-rr-marker mr-2"></i>Standort: {selectedProvider.location || 'Nicht verfügbar'}</p>
                                                                </div>

                                                                {/* URL anzeigen */}
                                                                {selectedProvider.URL && selectedProvider.URL.length > 0 ? (<div className="mt-4">
                                                                        <p className="font-semibold">Weitere Informationen:</p>
                                                                        <ul className="list-disc ml-5">
                                                                            {selectedProvider.URL.map(function (url, index) { return (<li key={index}>
                                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                                        {url}
                                                                                    </a>
                                                                                </li>); })}
                                                                        </ul>
                                                                    </div>) : (<div className="mt-4">
                                                                        <p className="text-gray-500">Keine URL verfügbar</p>
                                                                    </div>)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-end p-6 border-t border-solid border-blueGray-200 rounded-b">
                                                            <button className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none" onClick={function () { return setShowModal(false); }}>
                                                                SCHLIESSEN
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="opacity-5 fixed inset-0 z-40 bg-black"></div>
                                        </div>) : null}
                                </div>);
        })}
                    </div>
                </div>
            </div>
        </div>);
};
exports.default = GymiProviderOverview;
