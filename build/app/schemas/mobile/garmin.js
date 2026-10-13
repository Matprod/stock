import vine from '@vinejs/vine';
export const garminTokenQuerySchema = vine.compile(vine.object({
    request_token: vine.string(),
    request_token_secret: vine.string(),
    code: vine.string(),
}));
//# sourceMappingURL=garmin.js.map