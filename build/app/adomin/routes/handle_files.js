export const Attachment = { fromFile: (_o) => null };
export const loadFilesForInstances = async (fields, modelInstances) => {
    const filesColumn = fields.filter(({ adomin }) => adomin.type === 'file' && adomin.subType === 'attachment');
    const promises = modelInstances.flatMap(async (modelInstance) => {
        const innerPromises = filesColumn.map(async ({ name }) => {
            const attachment = modelInstance[name];
            if (!attachment || typeof attachment.url === 'string')
                return;
            const url = await attachment.getUrl();
            attachment.url = url;
        });
        await Promise.all(innerPromises);
    });
    await Promise.all(promises);
};
//# sourceMappingURL=handle_files.js.map