import string from '@adonisjs/core/helpers/string';
import { SUBJECTIVE_VARIABLE_DOMAIN, } from '#contracts/subjective_variable';
export const subjectiveFieldNameToModelAttribute = (domain, fieldName) => {
    if (domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC) {
        return fieldName;
    }
    return string.camelCase(fieldName);
};
//# sourceMappingURL=subjective_field_name.js.map