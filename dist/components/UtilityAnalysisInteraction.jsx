"use strict";
'use client';
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var calculation_1 = require("../utils/utilityAnalysis/calculation");
var checkForm_1 = require("../utils/utilityAnalysis/checkForm");
var GymiProviderOverview_1 = __importDefault(require("./GymiProviderOverview"));
var UtilityAnalysisInteraction = function (_a) {
    var GymiProviders = _a.GymiProviders, CourseDetails = _a.CourseDetails;
    var _b = (0, react_1.useState)([]), ratedGymiProviders = _b[0], setRatedGymiProviders = _b[1];
    var _c = (0, react_1.useState)([
        { id: 1, weight: '', criteria: '' },
        { id: 2, weight: '', criteria: '' },
        { id: 3, weight: '', criteria: '' },
        { id: 4, weight: '', criteria: '' },
        { id: 5, weight: '', criteria: '' },
    ]), params = _c[0], setParams = _c[1];
    // Gewichtung ändern
    var handleTitleChange = function (index, newWeight) {
        var updatedParams = __spreadArray([], params, true);
        updatedParams[index].weight = newWeight;
        setParams(updatedParams);
    };
    // Kriterium ändern
    var handleContentChange = function (index, newCriteria) {
        var updatedParams = __spreadArray([], params, true);
        updatedParams[index].criteria = newCriteria;
        setParams(updatedParams);
    };
    // Scoring berechnen
    var saveChanges = function () {
        var correctForm = (0, checkForm_1.checkForm)(params);
        if (correctForm === true) {
            if (GymiProviders && GymiProviders.length > 0) {
                var mappedProviders = GymiProviders.map(function (provider) {
                    var _a, _b, _c, _d, _e, _f;
                    var courseDetail = CourseDetails.find(function (detail) { return detail.ID === provider.id; }) || {};
                    var pricePerformance = (0, calculation_1.calculatePricePerformance)(provider, Number((_a = params.find(function (p) { return p.criteria === 'price-performance'; })) === null || _a === void 0 ? void 0 : _a.weight) || 0);
                    var quality = (0, calculation_1.calculateQuality)(courseDetail, Number((_b = params.find(function (p) { return p.criteria === 'quality'; })) === null || _b === void 0 ? void 0 : _b.weight) || 0);
                    var flexibility = (0, calculation_1.calculateFlexibility)(courseDetail, Number((_c = params.find(function (p) { return p.criteria === 'flexibility'; })) === null || _c === void 0 ? void 0 : _c.weight) || 0);
                    var additionalServices = (0, calculation_1.calculateAdditionalServices)(provider, courseDetail, Number((_d = params.find(function (p) { return p.criteria === 'additional-services'; })) === null || _d === void 0 ? void 0 : _d.weight) || 0);
                    var location = (0, calculation_1.calculateLocation)(courseDetail, Number((_e = params.find(function (p) { return p.criteria === 'location'; })) === null || _e === void 0 ? void 0 : _e.weight) || 0);
                    var totalScore = Math.round(pricePerformance + quality + flexibility + additionalServices + location);
                    return {
                        id: provider.id,
                        provider: provider.name,
                        pricePerformance: pricePerformance,
                        quality: quality,
                        flexibility: flexibility,
                        additionalServices: additionalServices,
                        location: location,
                        totalScore: totalScore,
                        URL: ((_f = provider.URL) === null || _f === void 0 ? void 0 : _f.length) ? provider.URL : [] // URLs sicher übertragen
                    };
                });
                var ratedGymiProvidersList = mappedProviders.sort(function (a, b) { return b.totalScore - a.totalScore; });
                setRatedGymiProviders(ratedGymiProvidersList);
            }
            else {
                console.error("No data available for Gymi providers");
                alert("Keine Daten für Gymi-Anbieter verfügbar.");
            }
        }
        else {
            alert(correctForm);
        }
    };
    // Liste zurücksetzen
    var deleteList = function () {
        setRatedGymiProviders([]);
        setParams([
            { id: 1, weight: '', criteria: '' },
            { id: 2, weight: '', criteria: '' },
            { id: 3, weight: '', criteria: '' },
            { id: 4, weight: '', criteria: '' },
            { id: 5, weight: '', criteria: '' },
        ]);
    };
    return (<div>
      {ratedGymiProviders.length === 0 ? (<div>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold leading-tight mb-2">
              Nutzwertanalyse
            </h2>
          </div>
          <p>
            Bitte wählen Sie Kriterien, die für die Nutzwertanalyse verwendet
            werden sollen aus. <br />
            Die Kriterien müssen einzeln gewichtet werden. Die Endsumme muss 100% ergeben.
          </p>
          <form>
            <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-4 overflow-x-auto">
              <div className="inline-block min-w-full shadow rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Kriterien
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Gewichtung (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map(function (param, index) { return (<tr key={index} className="hover:bg-gray-50">
                        <td className="px-5 py-5 border-b border-gray-200 text-sm">
                          <select className="h-full rounded border-gray-300 py-2 px-4 block w-full" value={param.criteria} onChange={function (e) { return handleContentChange(index, e.target.value); }}>
                            <option value="" disabled hidden>Kriterium auswählen</option>
                            <option value="price-performance">Preis-Leistungs-Verhältnis</option>
                            <option value="quality">Qualität des Unterrichts</option>
                            <option value="flexibility">Flexibilität der Kursgestaltung</option>
                            <option value="additional-services">Zusatzleistungen</option>
                            <option value="location">Standort</option>
                          </select>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 text-sm">
                          <input type="number" placeholder="Gewichtung" value={param.weight} onChange={function (e) { return handleTitleChange(index, e.target.value); }} className="w-full rounded border-gray-300 py-2 px-4"/>
                        </td>
                      </tr>); })}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
          <button onClick={saveChanges} className="bg-gray-700 text-white font-bold py-2 px-4 rounded mt-4 hover:bg-gray-800">
            Ausrechnen
          </button>
        </div>) : (<>
          <button onClick={deleteList} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
            Neu ausrechnen
          </button>
          <GymiProviderOverview_1.default gymiProviders={ratedGymiProviders} courseDetails={CourseDetails}/>
        </>)}
    </div>);
};
exports.default = UtilityAnalysisInteraction;
