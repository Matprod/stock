export const handleSpecialFieldsValidation = async (modelConfig, parsedData) => {
    for (const field of modelConfig.fields) {
        if (field.adomin.type === 'json') {
            const res = await validateJsonField(field, parsedData);
            if (res)
                return res;
        }
    }
    return null;
};
const validateJsonField = async (field, parsedData) => {
    if (field.adomin.type !== 'json')
        return null;
    const parsedDataValue = parsedData[field.name];
    if (!parsedDataValue)
        return null;
    try {
        const jsonParsedValue = JSON.parse(parsedDataValue);
        const { validation } = field.adomin;
        const res = validation ? await validation.validate(jsonParsedValue) : jsonParsedValue;
        parsedData[field.name] = res;
    }
    catch (error) {
        return {
            error: `Le champ ${field.name} (json) n'est pas valide`,
        };
    }
    return null;
};
//# sourceMappingURL=handle_special_fields_validation.js.map