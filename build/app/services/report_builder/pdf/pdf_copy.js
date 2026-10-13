import { DateTime } from 'luxon';
import { formatHours, translateUnit } from '#services/report_builder/report_units';
const formatDate = (iso, language) => {
    const date = DateTime.fromISO(iso).setLocale(language);
    if (!date.isValid)
        return iso;
    return date.toFormat('d MMM yyyy');
};
export const formatChartAxisLabel = (label, language) => {
    const date = DateTime.fromISO(label).setLocale(language);
    if (!date.isValid || label.length < 10)
        return label;
    return date.toFormat('d MMM');
};
export const formatTableCell = (copy, language, key, value) => {
    if (key === 'from' || key === 'to') {
        if (!value)
            return copy.table.status.ongoing;
        return formatDate(value, language);
    }
    if (key === 'status')
        return copy.table.status[value] ?? value;
    if (key === 'context')
        return copy.table.context[value] ?? value;
    return value;
};
export const formatKpiValue = (value, language, unit) => {
    if (value === null)
        return '-';
    if (unit === 'h')
        return formatHours(value);
    if (Number.isInteger(value))
        return value.toLocaleString(language);
    return value.toLocaleString(language, { maximumFractionDigits: 2 });
};
export const formatKpiUnit = (value, unit, language) => {
    if (value === null || unit === 'h')
        return null;
    return translateUnit(unit, language);
};
export const getPdfCopy = (language) => {
    const isFr = language === 'fr';
    return {
        brand: 'MAUNA',
        confidential: isFr ? 'Confidentiel - usage staff' : 'Confidential - staff use only',
        untitled: isFr ? 'Rapport' : 'Report',
        noData: isFr ? 'Aucune donnée' : 'No data',
        page: (current, total) => (isFr ? `Page ${current} / ${total}` : `Page ${current} of ${total}`),
        generatedAt: (at) => {
            const stamp = at.setLocale(language).toFormat('d MMM yyyy HH:mm');
            return isFr ? `Généré le ${stamp}` : `Generated ${stamp}`;
        },
        dateRange: (range) => `${formatDate(range.from, language)} - ${formatDate(range.to, language)}`,
        table: isFr
            ? {
                columns: {
                    player: 'Joueur',
                    injury: 'Blessure',
                    location: 'Zone',
                    from: 'Du',
                    to: 'Au',
                    status: 'Statut',
                    context: 'Contexte',
                },
                status: { ongoing: 'En cours', recovered: 'Rétablie' },
                context: { match: 'Match', training: 'Entraînement', other: 'Autre' },
            }
            : {
                columns: {
                    player: 'Player',
                    injury: 'Injury',
                    location: 'Location',
                    from: 'From',
                    to: 'To',
                    status: 'Status',
                    context: 'Context',
                },
                status: { ongoing: 'Ongoing', recovered: 'Recovered' },
                context: { match: 'Match', training: 'Training', other: 'Other' },
            },
    };
};
//# sourceMappingURL=pdf_copy.js.map