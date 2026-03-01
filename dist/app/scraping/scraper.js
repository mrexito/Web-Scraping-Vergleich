"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var puppeteer_1 = __importDefault(require("puppeteer"));
var supabase_js_1 = require("@supabase/supabase-js");
var supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Anbieter-URLs
var providers = [
    {
        id: 1,
        name: "Gymivorbereitung Zuerich",
        urls: [
            { type: "Intensiv", url: "https://gymivorbereitung-zuerich.ch/kurzzeit/sportferien" },
            { type: "Langzeit", url: "https://gymivorbereitung-zuerich.ch/langzeit/sportferien" }
        ]
    }
];
function scrapeWebsite() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, _i, providers_1, provider, _a, _b, entry, page, standortText, standort, teilnehmerText, maximaleTeilnehmer, match, preisText, preis, match, existingGymiProvider, error_1, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    browser = null;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 21, 22, 25]);
                    console.log('Starte den Scraping-Prozess...');
                    return [4 /*yield*/, puppeteer_1.default.launch({ headless: true })];
                case 2:
                    browser = _c.sent();
                    _i = 0, providers_1 = providers;
                    _c.label = 3;
                case 3:
                    if (!(_i < providers_1.length)) return [3 /*break*/, 20];
                    provider = providers_1[_i];
                    console.log("Scraping f\u00FCr Anbieter: ".concat(provider.name));
                    _a = 0, _b = provider.urls;
                    _c.label = 4;
                case 4:
                    if (!(_a < _b.length)) return [3 /*break*/, 19];
                    entry = _b[_a];
                    console.log("Besuche URL: ".concat(entry.url));
                    page = null;
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 14, 15, 18]);
                    return [4 /*yield*/, browser.newPage()];
                case 6:
                    page = _c.sent();
                    return [4 /*yield*/, page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 })];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, page.$$eval('li', function (elements) {
                            return elements
                                .map(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
                                .find(function (text) { return text === null || text === void 0 ? void 0 : text.includes('Kursort:'); }) || null;
                        })];
                case 8:
                    standortText = _c.sent();
                    standort = 'Unbekannt';
                    if (standortText) {
                        standort = standortText.replace('Kursort:', '').trim();
                        console.log("Standort gefunden: ".concat(standort));
                    }
                    return [4 /*yield*/, page.$$eval('li', function (elements) {
                            return elements
                                .map(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
                                .find(function (text) { return text === null || text === void 0 ? void 0 : text.includes('max. 10 Personen'); }) || null;
                        })];
                case 9:
                    teilnehmerText = _c.sent();
                    maximaleTeilnehmer = null;
                    if (teilnehmerText) {
                        match = teilnehmerText.match(/(\d+)\s*bis\s*max\.\s*(\d+)\s*Personen/);
                        maximaleTeilnehmer = match ? parseInt(match[2], 10) : null;
                        console.log("Maximale Teilnehmerzahl gefunden: ".concat(maximaleTeilnehmer));
                    }
                    return [4 /*yield*/, page.$$eval('li', function (elements) {
                            return elements
                                .map(function (el) { var _a; return (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
                                .find(function (text) { return text === null || text === void 0 ? void 0 : text.includes('Teilnahmegebühr'); }) || null;
                        })];
                case 10:
                    preisText = _c.sent();
                    preis = null;
                    if (preisText) {
                        match = preisText.match(/(\d{1,5})\s*CHF/);
                        preis = match ? parseInt(match[1], 10) : null;
                        console.log("Preis gefunden: ".concat(preis, " CHF"));
                    }
                    return [4 /*yield*/, supabase
                            .from('GymiProviders')
                            .select('*')
                            .eq('ID', provider.id)
                            .maybeSingle()];
                case 11:
                    existingGymiProvider = (_c.sent()).data;
                    if (!existingGymiProvider) {
                        console.warn("Kein GymiProvider gefunden f\u00FCr Anbieter: ".concat(provider.name));
                        return [3 /*break*/, 18];
                    }
                    console.log('Aktualisiere GymiProviders...');
                    return [4 /*yield*/, supabase
                            .from('GymiProviders')
                            .update(__assign(__assign({ "Maximale Anzahl der Teilnehmer": maximaleTeilnehmer }, (entry.type === "Intensiv" && { "Preis Intensiver Kurs": preis })), (entry.type === "Langzeit" && { "Preis Langzeit Kurs": preis })))
                            .eq('ID', provider.id)];
                case 12:
                    _c.sent();
                    console.log("Preis f\u00FCr ".concat(entry.type, "-Kurs aktualisiert."));
                    // Aktualisiere CourseDetails
                    console.log('Aktualisiere CourseDetails...');
                    return [4 /*yield*/, supabase
                            .from('CourseDetails')
                            .update({
                            Standort: standort,
                        })
                            .eq('ID', provider.id)];
                case 13:
                    _c.sent();
                    console.log('CourseDetails aktualisiert.');
                    return [3 /*break*/, 18];
                case 14:
                    error_1 = _c.sent();
                    console.error("Fehler beim Scraping von ".concat(entry.url, ":"), error_1.message);
                    return [3 /*break*/, 18];
                case 15:
                    if (!page) return [3 /*break*/, 17];
                    return [4 /*yield*/, page.close()];
                case 16:
                    _c.sent();
                    _c.label = 17;
                case 17: return [7 /*endfinally*/];
                case 18:
                    _a++;
                    return [3 /*break*/, 4];
                case 19:
                    _i++;
                    return [3 /*break*/, 3];
                case 20:
                    console.log('Scraping-Prozess abgeschlossen!');
                    return [3 /*break*/, 25];
                case 21:
                    error_2 = _c.sent();
                    console.error('Allgemeiner Fehler beim Scraping:', error_2.message);
                    return [3 /*break*/, 25];
                case 22:
                    if (!browser) return [3 /*break*/, 24];
                    return [4 /*yield*/, browser.close()];
                case 23:
                    _c.sent();
                    _c.label = 24;
                case 24:
                    console.log('Browser geschlossen.');
                    return [7 /*endfinally*/];
                case 25: return [2 /*return*/];
            }
        });
    });
}
// Starte den Scraping-Prozess
scrapeWebsite().catch(function (error) {
    return console.error('Fehler beim Starten von scrapeWebsite:', error.message);
});
