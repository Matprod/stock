export function splitBilingualName(row) {
    const nameEn = String(row.name_en ?? '').trim();
    const nameFr = String(row.name_fr ?? '').trim();
    if (!nameEn && !nameFr)
        return null;
    if (nameEn) {
        const translation = nameFr && nameFr !== nameEn ? { language: 'fr', value: nameFr } : undefined;
        return { name: nameEn, translation };
    }
    const translation = nameEn && nameEn !== nameFr ? { language: 'en', value: nameEn } : undefined;
    return { name: nameFr, translation };
}
//# sourceMappingURL=bilingual.js.map