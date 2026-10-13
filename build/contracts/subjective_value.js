export const buildCalendarHealthRow = (health, ratings, metrics) => {
    const dateOfDay = health.day.dateOfDay;
    const dateStr = typeof dateOfDay === 'object' && dateOfDay !== null && 'toISODate' in dateOfDay
        ? (dateOfDay.toISODate?.() ?? String(dateOfDay).slice(0, 10))
        : String(dateOfDay).slice(0, 10);
    return {
        id: health.id,
        ratings,
        metrics,
        athleteId: health.day.athleteId,
        day: {
            id: health.day.id,
            athleteId: health.day.athleteId,
            dateOfDay: dateStr,
        },
    };
};
//# sourceMappingURL=subjective_value.js.map