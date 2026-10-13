import vine from '@vinejs/vine';
export const stringIdValidator = vine.compile(vine.object({
    id: vine.string(),
}));
export const validateStringId = (data) => {
    return stringIdValidator.validate(data);
};
//# sourceMappingURL=validate_string_id.js.map