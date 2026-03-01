"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLocation = exports.calculateAdditionalServices = exports.calculateFlexibility = exports.calculateQuality = exports.calculatePricePerformance = void 0;
// 1. Preis-Leistungs-Verhältnis
var calculatePricePerformance = function (provider, weight) {
    var scorePricePerformance = 0;
    // Punkte basierend auf Preiskategorie
    if (provider['Preis-Kategorie'] === 'A') {
        scorePricePerformance += 3;
    }
    else if (provider['Preis-Kategorie'] === 'B') {
        scorePricePerformance += 2;
    }
    else if (provider['Preis-Kategorie'] === 'C') {
        scorePricePerformance += 1;
    }
    // Punkte basierend auf der Maximalen Teilnehmeranzahl
    var maxParticipants = parseInt(provider['Maximale Anzahl der Teilnehmer']);
    if (maxParticipants >= 1 && maxParticipants <= 5) {
        scorePricePerformance += 3;
    }
    else if (maxParticipants >= 6 && maxParticipants <= 10) {
        scorePricePerformance += 2;
    }
    else if (maxParticipants >= 11 && maxParticipants <= 15) {
        scorePricePerformance += 1;
    }
    // Finale Bewertung
    if (scorePricePerformance >= 5) {
        scorePricePerformance = 3;
    }
    else if (scorePricePerformance >= 3) {
        scorePricePerformance = 2;
    }
    else {
        scorePricePerformance = 1;
    }
    // Normalisierung und Gewichtung
    return Math.round((scorePricePerformance / 3) * weight);
};
exports.calculatePricePerformance = calculatePricePerformance;
// 2. Qualität des Unterrichts
var calculateQuality = function (courseDetail, weight) {
    var scoreQuality = 0;
    // Punkte basierend Qualitätsbewertung
    if (courseDetail.Qualitaetsbewertung === 1) {
        scoreQuality = 3;
    }
    else if (courseDetail.Qualitaetsbewertung === 2) {
        scoreQuality = 2;
    }
    else if (courseDetail.Qualitaetsbewertung === 3) {
        scoreQuality = 1;
    }
    // Normalisierung und Gewichtung
    return Math.round((scoreQuality / 3) * weight);
};
exports.calculateQuality = calculateQuality;
// 3. Flexibilität der Kursgestaltung
var calculateFlexibility = function (courseDetail, weight) {
    var scoreFlexibility = 0;
    // Unterrichtstage zählen
    var days = Array.isArray(courseDetail['Unterrichttag'])
        ? courseDetail['Unterrichttag'].length
        : courseDetail['Unterrichttag']
            ? courseDetail['Unterrichttag'].split(',').length
            : 0;
    if (days === 4) {
        scoreFlexibility += 3;
    }
    else if (days === 3) {
        scoreFlexibility += 2;
    }
    else if (days >= 1) {
        scoreFlexibility += 1;
    }
    // Kursart bewerten
    if (courseDetail['Kursart (Intensiv- oder Langzeitkurs)'] === 'Beides') {
        scoreFlexibility += 2;
    }
    else if (courseDetail['Kursart (Intensiv- oder Langzeitkurs)'] === 'Lang') {
        scoreFlexibility += 1;
    }
    // Finale Bewertung
    if (scoreFlexibility >= 4) {
        scoreFlexibility = 3;
    }
    else if (scoreFlexibility === 3) {
        scoreFlexibility = 2;
    }
    else {
        scoreFlexibility = 1;
    }
    return Math.round((scoreFlexibility / 3) * weight);
};
exports.calculateFlexibility = calculateFlexibility;
// 4. Zusatzleistungen berechnen
var calculateAdditionalServices = function (provider, courseDetail, weight) {
    var scoreAdditionalServices = 0;
    // Zusatzleistungen 
    scoreAdditionalServices += provider['E-Learning'] ? 2 : 1;
    scoreAdditionalServices += courseDetail['Eigene Lernunterlagen'] ? 2 : 1;
    scoreAdditionalServices += courseDetail['Nachholmoeglichkeiten'] ? 2 : 1;
    scoreAdditionalServices += courseDetail['Unterstuezung ausserhalb Unterrichtszeit'] ? 2 : 1;
    scoreAdditionalServices += courseDetail['Pruefungsarchiv'] ? 2 : 1;
    scoreAdditionalServices += provider['Aufsatzkorrektur'] ? 2 : 1;
    // Finale Bewertung
    if (scoreAdditionalServices >= 5) {
        scoreAdditionalServices = 3;
    }
    else if (scoreAdditionalServices >= 3) {
        scoreAdditionalServices = 2;
    }
    else {
        scoreAdditionalServices = 1;
    }
    return Math.round((scoreAdditionalServices / 3) * weight);
};
exports.calculateAdditionalServices = calculateAdditionalServices;
// 5. Berechnet Standort 
var calculateLocation = function (courseDetail, weight) {
    var scoreLocation = 0;
    // Standort zählen
    var locations = Array.isArray(courseDetail['Standort'])
        ? courseDetail['Standort'].length
        : courseDetail['Standort']
            ? courseDetail['Standort'].split(',').length
            : 0;
    if (locations >= 4) {
        scoreLocation = 3;
    }
    else if (locations === 3) {
        scoreLocation = 2;
    }
    else if (locations >= 1) {
        scoreLocation = 1;
    }
    return Math.round((scoreLocation / 3) * weight);
};
exports.calculateLocation = calculateLocation;
