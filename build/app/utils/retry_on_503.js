export async function retryOn503(fn, maxRetries = 3, context) {
    let retries = 0;
    let success = false;
    let lastError;
    while (retries <= maxRetries && !success) {
        try {
            const result = await fn();
            success = true;
            return result;
        }
        catch (error) {
            lastError = error;
            if (error?.status === 503 || error?.statusCode === 503 || error?.code === 503) {
                retries++;
                if (retries > maxRetries) {
                    console.error(`${context ? `${context}: ` : ''}Failed after ${maxRetries} retries:`, error);
                    throw error;
                }
                const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
                console.log(`${context ? `${context}: ` : ''}503 error, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            else {
                throw error;
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry_on_503.js.map