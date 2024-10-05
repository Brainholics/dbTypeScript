import s3 from "../db/verifyEmail/s3";
import { S3UploadResponse } from "../types/interfaces";


export async function uploadToS3(
    bucketName: string,
    FileName: string,
    Body: string,
    type: string,
): Promise<S3UploadResponse | null> {
    return new Promise<S3UploadResponse | null>((resolve, reject) => {
        s3.upload({
            Bucket: bucketName,
            Key: FileName,
            Body: Body,
            ACL: type,
        }, (err, data) => {
            if (err) {
                return resolve(null);
            }

            return resolve(data as S3UploadResponse);
        });
    });
}