export const computeRightsCheck = async (ctx, fn, sendBadRequestWithErrorMessage = true) => {
    if (!fn)
        return 'OK';
    const res = await fn(ctx);
    if (res.hasAccess === false) {
        if (res.errorMessage && sendBadRequestWithErrorMessage) {
            ctx.response.badRequest({ error: res.errorMessage });
        }
        return 'STOP';
    }
    return 'OK';
};
//# sourceMappingURL=adomin_routes_overrides_and_rights.js.map