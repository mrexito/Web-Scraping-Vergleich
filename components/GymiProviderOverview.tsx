'use client';
import React, { useState, useEffect } from "react";
import type { CourseDetail } from "@/schemas/courseDetailSchema";
import type { Course } from "@/schemas/courseSchema";

const NACHHILFE_AKADEMIE_ID = 6;
const LERNTERRASSE_ID = 11;
const LOGOS_LEHRERTEAM_ID = 10;
const SCHLAUMACHER_ID = 9;
const GYMIVORBEREITUNG_FOKUS_ID = 5;

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
    courses: Course[];
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

const PriceInfoTooltip = () => {
    const [visible, setVisible] = useState(false);
    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'default' }}>ℹ️</span>
            {visible && (
                <span style={{
                    position: 'absolute',
                    bottom: '120%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2C2C2A',
                    color: '#F1EFE8',
                    fontSize: '11px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                    Preise variieren je nach Kurstyp und Fächerwahl
                </span>
            )}
        </span>
    );
};

const NachhilfeAkademiePreisHinweis = ({ kurstyp }: { kurstyp?: 'langgymi' | 'kurzgymi' }) => {
    const thStyle: React.CSSProperties = {
        textAlign: 'left',
        padding: '5px 6px',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
        color: 'var(--color-text-secondary)',
        fontWeight: 600,
        fontSize: '11px',
        whiteSpace: 'nowrap',
    };
    const td: React.CSSProperties = {
        padding: '5px 6px',
        fontSize: '11px',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
    };
    const tdLast: React.CSSProperties = { ...td, borderBottom: 'none' };
    const sectionHeader: React.CSSProperties = {
        padding: '5px 6px',
        fontWeight: 600,
        fontSize: '11px',
        background: 'var(--color-background-secondary, #f9fafb)',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
    };

    return (
        <div style={{ marginTop: '4px' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Preisstruktur
            </p>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '6px', overflow: 'hidden' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Kurstyp</th>
                            <th style={thStyle}>Fach / Paket</th>
                            <th style={thStyle}>Privat</th>
                            <th style={thStyle}>2er-Gruppe</th>
                            <th style={thStyle}>4er-Gruppe</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={sectionHeader} rowSpan={4}>Wochenkurs<br /><span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>pro Fach, Aug–März</span></td>
                            <td style={td}>Deutsch Grammatik</td>
                            <td style={td}>CHF 2'420</td>
                            <td style={td}>CHF 2'156</td>
                            <td style={td}>CHF 1'628</td>
                        </tr>
                        <tr>
                            <td style={td}>Aufsatztraining</td>
                            <td style={td}>CHF 1'320</td>
                            <td style={td}>CHF 1'078</td>
                            <td style={td}>CHF 902</td>
                        </tr>
                        <tr>
                            <td style={td}>Mathematik</td>
                            <td style={td}>CHF 2'420</td>
                            <td style={td}>CHF 2'156</td>
                            <td style={td}>CHF 1'628</td>
                        </tr>
                        <tr>
                            <td style={td}>Förderung Vornote</td>
                            <td style={td}>CHF 2'420</td>
                            <td style={td}>CHF 2'156</td>
                            <td style={td}>CHF 1'628</td>
                        </tr>
                        <tr>
                            <td style={{ ...sectionHeader, borderBottom: 'none' }} rowSpan={3}>
                                Intensivkurs<br /><span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>Gesamtpaket, 1 Woche</span>
                            </td>
                            <td style={td}>Herbstferien 1</td>
                            <td style={td}>CHF 1'650</td>
                            <td style={{ ...td, color: 'var(--color-text-secondary)' }}>—</td>
                            <td style={td}>CHF 1'230</td>
                        </tr>
                        <tr>
                            <td style={td}>Herbstferien 2</td>
                            <td style={td}>CHF 1'650</td>
                            <td style={{ ...td, color: 'var(--color-text-secondary)' }}>—</td>
                            <td style={td}>CHF 1'230</td>
                        </tr>
                        <tr>
                            <td style={tdLast}>Winterferien</td>
                            <td style={tdLast}>
                                {kurstyp === 'kurzgymi' ? 'CHF 2\'200' : 'CHF 1\'650'}
                            </td>
                            <td style={{ ...tdLast, color: 'var(--color-text-secondary)' }}>—</td>
                            <td style={tdLast}>
                                {kurstyp === 'kurzgymi' ? 'CHF 1\'480' : 'CHF 1\'230'}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '5px' }}>
                * Preise exkl. Anmeldegebühr (CHF 100) und Kursmaterial (CHF 50 pro Fach). Intensivkurs: nur Privat oder 4er-Gruppe buchbar.
            </p>
        </div>
    );
};

const CheckIcon = ({ val }: { val?: boolean }) => (
    <span style={{ color: val ? '#0F6E56' : '#A32D2D', fontSize: '14px', fontWeight: 500 }}>
        {val ? '✓' : '✗'}
    </span>
);

const verfuegbarkeitBadgeSmall = (val?: string | null) => {
    if (!val) return <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>—</span>;
    if (val === 'ausgebucht') return <span style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: '11px', padding: '2px 6px', borderRadius: '20px' }}>Ausgebucht</span>;
    if (val === 'wenige') return <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: '11px', padding: '2px 6px', borderRadius: '20px' }}>Wenige Plätze</span>;
    return <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: '11px', padding: '2px 6px', borderRadius: '20px' }}>Viele Plätze</span>;
};

const typeBadge = (courseType: string | null) => {
    const isLang = courseType === 'langgymi';
    return (
        <span style={{
            background: isLang ? '#E6F1FB' : '#FAEEDA',
            color: isLang ? '#0C447C' : '#633806',
            fontSize: '10px', fontWeight: 500,
            padding: '2px 7px', borderRadius: '20px', whiteSpace: 'nowrap',
        }}>
            {isLang ? 'Langgymi' : courseType === 'kurzgymi' ? 'Kurzgymi' : courseType ?? '—'}
        </span>
    );
};


// Hilfsfunktionen für Lernterrasse
const extractStufe = (title: string): string => {
    if (title.includes('6. Klasse')) return '6. Klasse';
    if (title.includes('5. Klasse')) return '5. Klasse';
    if (title.includes('2./3. Sekundarstufe') || title.includes('2./3. Sek')) return '2./3. Sekundarstufe';
    if (title.includes('1./2. Sekundarstufe') || title.includes('1./2. Sek')) return '1./2. Sekundarstufe';
    return 'Weitere Kurse';
};

const WEEKDAY_LONG: Record<string, string> = {
    'Mo': 'Montag', 'Di': 'Dienstag', 'Mi': 'Mittwoch',
    'Do': 'Donnerstag', 'Fr': 'Freitag', 'Sa': 'Samstag', 'So': 'Sonntag',
};

const normalizeWochentag = (raw: string | null | undefined): string => {
    if (!raw) return '—';
    return raw.split(/\s*[&,]\s*/).map(part => {
        const trimmed = part.trim();
        return WEEKDAY_LONG[trimmed] ?? trimmed;
    }).join(' & ');
};

const extractAbschnitt = (title: string): string => {
    if (title.includes('Teil I-III') || title.includes('Teil I–III')) return 'Gesamtpaket Teil I–III';
    if (title.includes('Herbstferienkurs 1') || title.includes('Herbstferienkurs1')) return 'Herbstferienkurs 1';
    if (title.includes('Herbstferienkurs 2') || title.includes('Herbstferienkurs2')) return 'Herbstferienkurs 2';
    if (title.includes('Weihnachtsferienkurs')) return 'Weihnachtsferienkurs';
    if (title.includes('2. Sportferienwoche')) return '2. Sportferienwoche';
    if (title.includes('1. Sportferienwoche') || title.includes('Sportferienkurs')) return '1. Sportferienwoche';
    if (title.includes('Ferienkurs')) return 'Ferienkurs';
    if (title.includes('Start Oktober') || title.includes('Oktober')) return 'Start Oktober';
    if (title.includes('Start September') || title.includes('September')) return 'Start September';
    if (title.includes('Teil 3') || title.includes('Teil III')) return 'Teil 3';
    if (title.includes('Teil 2') || title.includes('Teil II')) return 'Teil 2';
    if (title.includes('Teil 1') || title.includes('Teil I')) return 'Teil 1';
    return 'Weitere Kurse';
};

const ABSCHNITT_ORDER = ['Gesamtpaket Teil I–III', 'Teil 1', 'Teil 2', 'Teil 3', 'Start September', 'Start Oktober', '1. Sportferienwoche', '2. Sportferienwoche', 'Herbstferienkurs 1', 'Herbstferienkurs 2', 'Weihnachtsferienkurs', 'Ferienkurs'];
const ABSCHNITT_META: Record<string, { beschreibung: string }> = {
    'Gesamtpaket Teil I–III': { beschreibung: 'Alle drei Phasen · Aug 2026 – Feb 2027 · 22 Kurstage' },
    'Teil 1':                 { beschreibung: 'Grundlagen · Aug – Sep 2026 · 6 Wochen' },
    'Teil 2':                 { beschreibung: 'Aufbauen & Festigen · Okt – Dez 2026 · 8 Wochen' },
    'Teil 3':                 { beschreibung: 'Prüfungsvorbereitung · Jan – Feb 2027 · 5 Wochen' },
    'Start September':        { beschreibung: 'Schulbegleitend · Sep 2026 – Feb 2027 · 20 Lektionen · CHF 2\'940' },
    'Start Oktober':          { beschreibung: 'Schulbegleitend · Okt 2026 – Feb 2027 · 17 Lektionen · CHF 2\'499' },
    '1. Sportferienwoche':    { beschreibung: 'Intensivkurs · 15.–19. Feb 2027 · Mo–Fr · CHF 980' },
    '2. Sportferienwoche':    { beschreibung: 'Intensivkurs · 22.–26. Feb 2027 · Mo–Fr · CHF 980' },
    'Herbstferienkurs 1':     { beschreibung: 'Intensivkurs · 05.–10. Oktober 2026' },
    'Herbstferienkurs 2':     { beschreibung: 'Intensivkurs · 12.–17. Oktober 2026' },
    'Weihnachtsferienkurs':   { beschreibung: 'Intensivkurs · Dezember 2026 · Zürich-City' },
};

const STUFE_ORDER_LANG = ['6. Klasse', '5. Klasse'];
const STUFE_ORDER_KURZ = ['2./3. Sekundarstufe', '1./2. Sekundarstufe'];

const AbschnittAccordion = ({
    abschnitt, courses, defaultOpen = false,
}: { abschnitt: string; courses: Course[]; defaultOpen?: boolean; }) => {
    const [open, setOpen] = React.useState(defaultOpen);
    const preis = courses[0]?.price_chf;
    const meta = ABSCHNITT_META[abschnitt];
    const th: React.CSSProperties = {
        textAlign: 'left', padding: '7px 10px',
        borderBottom: '0.5px solid var(--color-border-secondary)',
        color: 'var(--color-text-secondary)', fontWeight: 500,
        fontSize: '11px', whiteSpace: 'nowrap',
        background: 'var(--color-background-secondary)',
    };
    const td = (last: boolean): React.CSSProperties => ({
        padding: '8px 10px', fontSize: '12px',
        borderBottom: last ? 'none' : '0.5px solid var(--color-border-tertiary)',
        verticalAlign: 'top', color: 'var(--color-text-primary)',
    });
    return (
        <div style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div onClick={() => setOpen(!open)} style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                background: 'var(--color-background-secondary)',
                borderBottom: open ? '0.5px solid var(--color-border-secondary)' : 'none',
            }}>
                <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{abschnitt}</div>
                    {meta && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{meta.beschreibung}</div>}
                    {abschnitt === 'Gemäss Teil 1' && (
                        <div style={{ fontSize: '11px', color: '#854F0B', marginTop: '2px' }}>
                            ℹ️ Standort identisch mit deinem gebuchten Teil 1 Kurs
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {preis != null && (
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            CHF {preis.toLocaleString('de-CH')}
                        </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>▾</span>
                </div>
            </div>
            {open && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead><tr>
                            <th style={{ ...th, width: '22%' }}>Kurs</th>
                            <th style={{ ...th, width: '22%' }}>Wochentag</th>
                            <th style={{ ...th, width: '22%' }}>Kurszeit</th>
                            <th style={{ ...th, width: '20%' }}>Beginn</th>
                            <th style={{ ...th, width: '14%' }}>Verfügbarkeit</th>
                        </tr></thead>
                        <tbody>
                            {courses.map((course, i) => {
                                const isLast = i === courses.length - 1;
                                return (
                                    <tr key={i} style={{ background: i % 2 !== 0 ? 'var(--color-background-secondary)' : 'transparent' }}>
                                        <td style={{ ...td(isLast), fontWeight: 500 }}>{course.title?.split('|')[0]?.trim() || '—'}</td>
                                        <td style={td(isLast)}>
                                            {normalizeWochentag(course.occurrence)}
                                        </td>
                                        <td style={td(isLast)}>{course.course_time || '—'}</td>
                                        <td style={{ ...td(isLast), whiteSpace: 'nowrap' }}>
                                            {course.start_date ? new Date(course.start_date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                        </td>
                                        <td style={td(isLast)}>{verfuegbarkeitBadgeSmall(course.verfuegbarkeit)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const CourseTable = ({
    courses, kurstyp, isLernterrasse = false, providerId,
}: { courses: Course[]; kurstyp?: 'langgymi' | 'kurzgymi'; isLernterrasse?: boolean; providerId?: number; }) => {
    const filtered = kurstyp ? courses.filter(c => c.course_type === kurstyp) : courses;
    const th: React.CSSProperties = {
        textAlign: 'left', padding: '7px 10px',
        borderBottom: '0.5px solid var(--color-border-secondary)',
        color: 'var(--color-text-secondary)', fontWeight: 500,
        fontSize: '11px', whiteSpace: 'nowrap',
        background: 'var(--color-background-secondary)',
    };
    const td = (last: boolean): React.CSSProperties => ({
        padding: '8px 10px', fontSize: '12px',
        borderBottom: last ? 'none' : '0.5px solid var(--color-border-tertiary)',
        verticalAlign: 'top', color: 'var(--color-text-primary)',
    });

    if (filtered.length === 0) {
        return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Keine Kursdaten vorhanden.</p>;
    }

    if (isLernterrasse) {
        // Gymivorbereitung Fokus: nach Standort gruppieren
        if (providerId === GYMIVORBEREITUNG_FOKUS_ID) {
            const standortGroups: Record<string, Course[]> = {};
            for (const course of filtered) {
                const standort = course.location || 'Weitere';
                if (!standortGroups[standort]) standortGroups[standort] = [];
                standortGroups[standort].push(course);
            }
            const orderedStandorte = Object.keys(standortGroups).sort();
            return (
                <div>
                    {orderedStandorte.map((standort, idx) => (
                        <AbschnittAccordion
                            key={standort}
                            abschnitt={standort}
                            courses={standortGroups[standort]}
                            defaultOpen={idx === 0}
                        />
                    ))}
                </div>
            );
        }

        // Logos Lehrerteam + Schlaumacher: direkt nach Abschnitt gruppieren (keine Stufen)
        if (providerId === LOGOS_LEHRERTEAM_ID || providerId === SCHLAUMACHER_ID) {
            const abschnittGroups: Record<string, Course[]> = {};
            for (const course of filtered) {
                const abschnitt = extractAbschnitt(course.title || '');
                if (!abschnittGroups[abschnitt]) abschnittGroups[abschnitt] = [];
                abschnittGroups[abschnitt].push(course);
            }
            const orderedAbschnitte = [
                ...ABSCHNITT_ORDER.filter(a => abschnittGroups[a]),
                ...Object.keys(abschnittGroups).filter(k => !ABSCHNITT_ORDER.includes(k)),
            ];
            return (
                <div>
                    {orderedAbschnitte.map((abschnitt, idx) => (
                        <AbschnittAccordion key={abschnitt} abschnitt={abschnitt} courses={abschnittGroups[abschnitt]} defaultOpen={idx === 0} />
                    ))}
                </div>
            );
        }

        // Lernterrasse: nach Stufe, dann nach Abschnitt gruppieren
        const stufeOrder = kurstyp === 'kurzgymi' ? STUFE_ORDER_KURZ : STUFE_ORDER_LANG;
        const stufeGroups: Record<string, Course[]> = {};
        for (const course of filtered) {
            const stufe = extractStufe(course.title || '');
            if (!stufeGroups[stufe]) stufeGroups[stufe] = [];
            stufeGroups[stufe].push(course);
        }
        const orderedStufen = [
            ...stufeOrder.filter(s => stufeGroups[s]),
            ...Object.keys(stufeGroups).filter(k => !stufeOrder.includes(k)),
        ];
        return (
            <div>
                {orderedStufen.map((stufe, si) => {
                    const gymTypLabel = kurstyp === 'langgymi' ? 'Langzeitgymnasium' : 'Kurzzeitgymnasium';
                    const abschnittGroups: Record<string, Course[]> = {};
                    for (const course of stufeGroups[stufe]) {
                        const abschnitt = extractAbschnitt(course.title || '');
                        if (!abschnittGroups[abschnitt]) abschnittGroups[abschnitt] = [];
                        abschnittGroups[abschnitt].push(course);
                    }
                    const orderedAbschnitte = [
                        ...ABSCHNITT_ORDER.filter(a => abschnittGroups[a]),
                        ...Object.keys(abschnittGroups).filter(k => !ABSCHNITT_ORDER.includes(k)),
                    ];
                    return (
                        <div key={stufe} style={{ marginBottom: si < orderedStufen.length - 1 ? '20px' : '0' }}>
                            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                {gymTypLabel} — {stufe}
                            </p>
                            {orderedAbschnitte.map((abschnitt, idx) => (
                                <AbschnittAccordion key={abschnitt} abschnitt={abschnitt} courses={abschnittGroups[abschnitt]} defaultOpen={idx === 0} />
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '0.5px solid var(--color-border-secondary)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead><tr>
                    <th style={th}>Kurs</th><th style={th}>Standort</th><th style={th}>Wochentag</th>
                    <th style={th}>Kurszeit</th><th style={th}>Beginn</th><th style={th}>Preis</th><th style={th}>Verfügbarkeit</th>
                </tr></thead>
                <tbody>
                    {filtered.map((course, i) => {
                        const isLast = i === filtered.length - 1;
                        const hasDiscount = course.price_regular_chf != null && course.price_regular_chf > (course.price_chf ?? 0);
                        return (
                            <tr key={i} style={{ background: i % 2 !== 0 ? 'var(--color-background-secondary)' : 'transparent' }}>
                                <td style={td(isLast)}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 500, fontSize: '12px' }}>{course.title?.split('|')[0]?.trim() || '—'}</span>
                                        {typeBadge(course.course_type)}
                                    </div>
                                </td>
                                <td style={td(isLast)}>
                                    {course.location === 'Gemäss Teil 1' ? (
                                        <span>
                                            <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Gemäss Teil 1</span>
                                            <span style={{ display: 'block', fontSize: '10px', color: '#854F0B', marginTop: '2px' }}>ℹ️ Identisch mit gewähltem Teil 1 Standort</span>
                                        </span>
                                    ) : course.location || '—'}
                                </td>
                                <td style={td(isLast)}>{course.occurrence || '—'}</td>
                                <td style={td(isLast)}>{course.course_time || '—'}</td>
                                <td style={{ ...td(isLast), whiteSpace: 'nowrap' }}>
                                    {course.start_date ? new Date(course.start_date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                </td>
                                <td style={{ ...td(isLast), whiteSpace: 'nowrap' }}>
                                    {course.price_chf != null ? (
                                        <span>
                                            {hasDiscount && <span style={{ textDecoration: 'line-through', color: 'var(--color-text-secondary)', marginRight: '4px', fontSize: '11px' }}>CHF {course.price_regular_chf?.toLocaleString('de-CH')}</span>}
                                            <span style={{ fontWeight: hasDiscount ? 500 : 400 }}>CHF {course.price_chf.toLocaleString('de-CH')}</span>
                                            {hasDiscount && course.discount_valid_until && (
                                                <span style={{ fontSize: '10px', color: '#854F0B', display: 'block' }}>Rabatt bis {new Date(course.discount_valid_until).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                            )}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td style={td(isLast)}>{verfuegbarkeitBadgeSmall(course.verfuegbarkeit)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const GymiProviderOverview = ({ gymiProviders, courseDetails, courses }: GymiProviderOverviewProps) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowModal(false);
        };
        if (showModal) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    const toggleModal = (providerId: number, state: boolean) => {
        const selected = gymiProviders.find((p) => p.id === providerId);
        if (!selected) return;
        const courseDetail = courseDetails.find((detail) => detail.ID === selected.id);
        if (!courseDetail) return;
        setSelectedProvider({ ...courseDetail, ...selected });
        setShowModal(state);
    };

    const providerCourses = selectedProvider
        ? courses.filter(c => c.provider_id != null && c.provider_id === selectedProvider.id)
        : [];

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
                    <p className="text-sm text-gray-600 mb-4">
                        ⚠️ Die angezeigten Preise dienen als Orientierung und sind je nach Anbieter unterschiedlich definiert (Gesamtpaket, pro Fach, Gruppen- oder Einzelpreis). Details sind im jeweiligen Anbieter-Modal ersichtlich.
                    </p>
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
                                                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center' }}>
                                                        {provider.rawPrice && provider.rawPrice !== 'Nicht verfügbar'
                                                            ? (typeof provider.rawPrice === 'string' && provider.rawPrice.startsWith('CHF')
                                                                ? provider.rawPrice
                                                                : 'CHF ' + provider.rawPrice)
                                                            : 'Nicht verfügbar'}
                                                        {provider.id === NACHHILFE_AKADEMIE_ID && <PriceInfoTooltip />}
                                                    </p>
                                                </div>
                                                <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Unterrichtstag</p>
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
                                                        : <span style={{ background: '#EEF0F5', color: '#4A5270', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontStyle: 'italic' }}>Nicht publiziert</span>}
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
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                        className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none"
                    >
                        <div className="relative w-auto my-6 mx-auto" style={{ width: '90vw', maxWidth: '800px' }}>
                            <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">

                                {/* Header */}
                                <div className="flex items-center justify-between p-5 border-b border-solid rounded-t">
                                    <h3 id="modal-title" className="text-xl font-semibold">{selectedProvider.provider}</h3>
                                    <button
                                        className="p-1 ml-auto bg-transparent border-0 text-black text-3xl leading-none font-semibold outline-none focus:outline-none"
                                        onClick={() => setShowModal(false)}
                                        aria-label="Modal schliessen"
                                    >
                                        <span className="text-black h-6 w-6 text-2xl block outline-none focus:outline-none">x</span>
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="relative p-6 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>

                                    {/* Kursdetails */}
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                            Kursdetails
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Qualität</p>
                                                <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{qualitaetLabel(selectedProvider.Qualitaetsbewertung)}</p>
                                            </div>
                                            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Max. Teilnehmer</p>
                                                <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{selectedProvider['Maximale Anzahl der Teilnehmer'] || 'Nicht verfügbar'}</p>
                                            </div>
                                            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Standort</p>
                                                <p style={{ fontSize: '13px', fontWeight: 500, margin: 0 }}>{selectedProvider.Standort || 'Nicht verfügbar'}</p>
                                            </div>
                                            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Verfügbarkeit</p>
                                                {verfuegbarkeit
                                                    ? verfuegbarkeitBadge(verfuegbarkeit)
                                                    : <span style={{ background: '#EEF0F5', color: '#4A5270', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontStyle: 'italic' }}>Nicht publiziert</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nachhilfe Akademie Sonderfall */}
                                    {selectedProvider.id === NACHHILFE_AKADEMIE_ID && (
                                        <NachhilfeAkademiePreisHinweis kurstyp={selectedProvider.kurstyp} />
                                    )}

                                    {/* Kursliste */}
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                            Kurse
                                        </p>
                                        <CourseTable
                                            courses={providerCourses}
                                            kurstyp={selectedProvider.kurstyp}
                                            isLernterrasse={selectedProvider.id === LERNTERRASSE_ID || selectedProvider.id === LOGOS_LEHRERTEAM_ID || selectedProvider.id === SCHLAUMACHER_ID || selectedProvider.id === GYMIVORBEREITUNG_FOKUS_ID}
                                            providerId={selectedProvider.id}
                                        />
                                    </div>

                                    {/* Zusatzleistungen */}
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
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
                                    </div>

                                </div>

                                {/* Footer mit Anmelde-Links + Schliessen */}
                                <div className="flex flex-col p-6 border-t border-solid rounded-b gap-3">

                                    {/* Anmelde-CTA — Lernterrasse: zwei Links je Kurstyp */}
                                    {selectedProvider.id === SCHLAUMACHER_ID ? (
                                        <div style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                            <a href="https://www.schlaumacher.ch/gymivorbereitung-zuerich/" target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', background: 'var(--color-background-primary)' }}>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                        {selectedProvider.kurstyp === 'langgymi' ? 'Langzeitgymnasium' : 'Kurzzeitgymnasium'} — Zur Anmeldung
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>schlaumacher.ch</div>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                            </a>
                                        </div>
                                    ) : selectedProvider.id === LOGOS_LEHRERTEAM_ID ? (
                                        <div style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                            <a href="https://www.logos-lehrerteam.ch/kurse-gymivorbereitung-zap-anmeldung" target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', background: 'var(--color-background-primary)' }}>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                        {selectedProvider.kurstyp === 'langgymi' ? 'Langzeitgymnasium' : 'Kurzzeitgymnasium'} — Zur Anmeldung
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>logos-lehrerteam.ch</div>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                            </a>
                                        </div>
                                    ) : selectedProvider.id === LERNTERRASSE_ID ? (
                                        <div style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                            {selectedProvider.kurstyp === 'langgymi' || !selectedProvider.kurstyp ? (
                                                <>
                                                    <a href="https://lernterrasse.ch/6-klasse-gymi-kurs/" target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Langzeitgymnasium 6. Klasse</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Hauptanmeldung</div>
                                                        </div>
                                                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                                    </a>
                                                    <a href="https://lernterrasse.ch/5-klasse-progymi-kurs/" target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', background: 'var(--color-background-primary)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Langzeitgymnasium 5. Klasse</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Progymi-Kurs</div>
                                                        </div>
                                                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                                    </a>
                                                </>
                                            ) : (
                                                <>
                                                    <a href="https://lernterrasse.ch/2-oder-3-sekundarstufe-gymi-kurs/" target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Kurzzeitgymnasium 2./3. Sekundarstufe</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Hauptanmeldung</div>
                                                        </div>
                                                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                                    </a>
                                                    <a href="https://lernterrasse.ch/1-oder-2-sekundarstufe-progymi-kurs/" target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', background: 'var(--color-background-primary)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Kurzzeitgymnasium 1./2. Sekundarstufe</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Progymi-Kurs</div>
                                                        </div>
                                                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    ) : anmeldeUrl ? (
                                        <div style={{ border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                                            <a href={anmeldeUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', background: 'var(--color-background-primary)' }}>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                        {anmeldeLabel.replace(' →', '')}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                        {(() => { try { return new URL(anmeldeUrl).hostname.replace('www.', ''); } catch { return anmeldeUrl; } })()}
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→</span>
                                            </a>
                                        </div>
                                    ) : selectedProvider.URL && selectedProvider.URL.length > 0 ? (
                                        <div>
                                            <p className="font-semibold text-sm mb-1">Website:</p>
                                            <ul className="list-disc ml-5">
                                                {selectedProvider.URL.map((url, i) => (
                                                    <li key={i}>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{url}</a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}

                                    <div className="flex items-center justify-end">
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
                    </div>
                    <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
                </div>
            )}
        </div>
    );
};

export default GymiProviderOverview;
