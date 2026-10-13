import vine from '@vinejs/vine';
const TIME_FORMAT = 'HH:mm';
const TIME_WITH_SECONDS_FORMAT = 'HH:mm:ss';
function dateToTimeString(d) {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}
const dateToTimeWithSecondsString = (d) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};
export const timeWithSecondsString = () => vine
    .date({ formats: [TIME_WITH_SECONDS_FORMAT] })
    .transform((value) => (value === null ? null : dateToTimeWithSecondsString(value)));
export const timeString = () => vine
    .date({ formats: [TIME_FORMAT] })
    .transform((value) => (value === null ? null : dateToTimeString(value)));
//# sourceMappingURL=time.js.map