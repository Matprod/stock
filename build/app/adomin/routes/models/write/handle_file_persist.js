import { Attachment } from '../../handle_files.js';
const handleDeleteFile = async (config, lucidInstance, fieldName) => {
    const instance = lucidInstance;
    if (config.subType === 'custom') {
        return config.deleteFile(instance);
    }
    if (config.subType === 'url') {
        await config.deleteFile(instance[fieldName]);
        instance[fieldName] = null;
        return;
    }
    if (config.subType === 'attachment') {
        instance[fieldName] = null;
        return;
    }
    throw new Error('Unknown file subType');
};
export const handleFilePersist = async (config, lucidInstance, fieldName, data) => {
    const instance = lucidInstance;
    const fileData = data[fieldName];
    if (fileData === undefined)
        return;
    if (fileData === null)
        return handleDeleteFile(config, lucidInstance, fieldName);
    if (config.subType === 'attachment') {
        instance[fieldName] = Attachment.fromFile(fileData);
        return;
    }
    if (config.subType === 'custom') {
        if (instance[fieldName]) {
            await config.deleteFile(lucidInstance);
        }
        return config.createFile(lucidInstance, fileData);
    }
    if (config.subType === 'url') {
        if (instance[fieldName]) {
            await config.deleteFile(instance[fieldName]);
        }
        instance[fieldName] = await config.createFile(fileData);
        return;
    }
    throw new Error('Unknown file subType');
};
//# sourceMappingURL=handle_file_persist.js.map