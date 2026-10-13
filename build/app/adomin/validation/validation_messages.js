import { getModelConfig } from '../routes/models/get_model_config.js';
import { getValidationMessage } from './get_validation_message.js';
const getFieldName = (fieldName) => {
    const split = fieldName.split('.');
    return split[split.length - 1];
};
const getFieldLabel = (fieldName, Model) => {
    const { fields } = getModelConfig(Model.name);
    const found = fields.find(({ name }) => name === fieldName);
    return found?.adomin.label ?? fieldName;
};
const getGenericMessagesBase = (rule, fieldLabel) => {
    if (rule === 'email') {
        return getValidationMessage('rules.email', fieldLabel);
    }
    if (rule === 'required') {
        return getValidationMessage('rules.required', fieldLabel);
    }
    if (rule === 'unique') {
        return getValidationMessage('rules.unique', fieldLabel);
    }
    if (rule === 'confirmed') {
        return getValidationMessage('rules.confirmed', fieldLabel);
    }
    if (rule === 'regex') {
        return getValidationMessage('rules.regex', fieldLabel);
    }
    return getValidationMessage('rules.other', fieldLabel, rule);
};
export const getGenericMessages = (Model) => ({
    '*': (field, rule, _ptr) => {
        const fieldName = getFieldName(field);
        const fieldLabel = getFieldLabel(fieldName, Model);
        return getGenericMessagesBase(rule, fieldLabel);
    },
});
const getStatFilterLabel = (fieldName, filters) => {
    const keys = Object.keys(filters);
    const keyFound = keys.find((key) => key === fieldName);
    if (!keyFound)
        return fieldName;
    const fieldLabel = filters[keyFound].label ?? fieldName;
    return fieldLabel;
};
export const getGenericMessagesForStatFilters = (filters) => ({
    '*': (field, rule, _ptr) => {
        const fieldName = getFieldName(field);
        const fieldLabel = getStatFilterLabel(fieldName, filters);
        return getGenericMessagesBase(rule, fieldLabel);
    },
});
//# sourceMappingURL=validation_messages.js.map