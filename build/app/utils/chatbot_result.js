export function cleanJsonResponse(response) {
    try {
        JSON.parse(response);
        return response;
    }
    catch (error) {
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('No valid JSON structure found');
        }
        let jsonPart = response.substring(jsonStart, jsonEnd + 1);
        jsonPart = jsonPart
            .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
        let inString = false;
        let escaped = false;
        let result = '';
        for (let i = 0; i < jsonPart.length; i++) {
            const char = jsonPart[i];
            if (escaped) {
                result += char;
                escaped = false;
            }
            else if (char === '\\') {
                result += char;
                escaped = true;
            }
            else if (char === '"') {
                inString = !inString;
                result += char;
            }
            else if (char === '\n' && inString) {
                result += '\\n';
            }
            else {
                result += char;
            }
        }
        return result;
    }
}
export function tryParseJsonResponse(response) {
    const attempt = (text) => {
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed?.response !== 'string')
                return null;
            return {
                response: parsed.response,
                questions: Array.isArray(parsed.questions) ? parsed.questions : [],
            };
        }
        catch (error) {
            return null;
        }
    };
    const tryClean = (s) => {
        try {
            return cleanJsonResponse(s);
        }
        catch {
            return null;
        }
    };
    return attempt(response) ?? attempt(tryClean(response) ?? '');
}
//# sourceMappingURL=chatbot_result.js.map