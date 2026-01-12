import { IFile } from "../types/file.type";

export const formatFileToUrl = (file: IFile) => {
  return `https://${import.meta.env.VITE_AWS_S3_IMAGE_BUCKET}.s3.${
    import.meta.env.VITE_AWS_REGION
  }.amazonaws.com/${file.key}`;
};
