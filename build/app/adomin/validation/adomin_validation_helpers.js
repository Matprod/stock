const ADOMIN_VALIDATION_MODES = ['create', 'update', 'stat-filter'];
export const isAdonisSchema = (input) => {
    return typeof input === 'object' && input !== null && 'props' in input && 'tree' in input;
};
const validateAtom = async (ctx, atom) => {
    if (typeof atom === 'function') {
        const result = await atom(ctx);
        if (result.valid === true)
            return true;
        if (result.errorMessage === undefined)
            return false;
        ctx.response.badRequest({ error: result.errorMessage });
        return false;
    }
    await ctx.request.validate({ schema: atom.schema, messages: atom.messages });
    return true;
};
export const validateOrThrow = async (ctx, validationParams, mode) => {
    const finalMode = mode === 'stat-filter' ? 'create' : mode;
    const validationAtom = validationParams[finalMode];
    if (!validationAtom)
        return true;
    return validateAtom(ctx, validationAtom);
};
//# sourceMappingURL=adomin_validation_helpers.js.map