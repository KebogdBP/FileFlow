from typing import Any, Protocol

import boto3
from botocore.client import Config


class ObjectStorage(Protocol):
    def create_multipart(self, key: str, content_type: str) -> str: ...

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str: ...

    def complete_multipart(
        self, key: str, upload_id: str, parts: list[tuple[int, str]]
    ) -> None: ...

    def abort_multipart(self, key: str, upload_id: str) -> None: ...


class S3ObjectStorage:
    def __init__(
        self,
        *,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str,
    ) -> None:
        self._bucket = bucket
        # Boto3 exposes service methods dynamically; the protocol contains our typed boundary.
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(signature_version="s3v4"),
        )

    def create_multipart(self, key: str, content_type: str) -> str:
        response = self._client.create_multipart_upload(
            Bucket=self._bucket, Key=key, ContentType=content_type
        )
        return str(response["UploadId"])

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str:
        return str(
            self._client.generate_presigned_url(
                "upload_part",
                Params={
                    "Bucket": self._bucket,
                    "Key": key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=ttl,
            )
        )

    def complete_multipart(self, key: str, upload_id: str, parts: list[tuple[int, str]]) -> None:
        self._client.complete_multipart_upload(
            Bucket=self._bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={
                "Parts": [{"PartNumber": number, "ETag": etag} for number, etag in parts]
            },
        )

    def abort_multipart(self, key: str, upload_id: str) -> None:
        self._client.abort_multipart_upload(Bucket=self._bucket, Key=key, UploadId=upload_id)
