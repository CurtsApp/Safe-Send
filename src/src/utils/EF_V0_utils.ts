import { readBinaryFile, writeBinaryFile } from "@tauri-apps/api/fs";
import { Contact } from "../interfaces/Contact";
import { ECDSA_SIG_LEN, GenerateAesCtrSingleUseKey, VerifyBin } from "./crypto_utils";
import { getPaddedUint32, getUint32, getUint32FromOffset } from "./general_utils";
import { AES_CTR_NONCE_SIZE, EFFormat } from "./key_utils";
import { User } from "../interfaces/User";

/*
Encrypted file structure
1 uint8 (File format type (Version 0 for this format))
16 uint8 (AES Counter Nonce)
1 uint8 (RSA user count)
[ (each Rsa user)
1 uint32 (key size)
AES key (wrapped with recipient RSA-OAEP)
]
AES-CTR encrypted payload begin to end of file
    uint8 file name length
    File name
    File itself
    ECDSA Signature (over unencrypted AES portion)
ECDSA Signature of entire file
*/

export async function EF_V0_EncryptFile(binInputFile: Uint8Array, fileName: string, outputFilePath: string, recipients: Contact[], user: User) {
    const fileFormat = new Uint8Array([EFFormat.V0]);
    // Add file format (fixed uint8)
    await writeBinaryFile(outputFilePath, fileFormat);

    const aesKey = await GenerateAesCtrSingleUseKey();
    // Add AES-CTR nonce (fixed 16 uint8s)
    await writeBinaryFile(outputFilePath, aesKey.ctr, { append: true });

    // Add RSA user count
    await writeBinaryFile(outputFilePath, new Uint8Array([recipients.length]), { append: true });

    // Add RSA wrapped keys
    const rsaPayloadsPromises = recipients.map(async recipient => {
        return window.crypto.subtle.wrapKey(
            "raw",
            aesKey.key,
            recipient.publicEncryptionKey,
            { name: "RSA-OAEP" }
        );
    });
    const rsaPayloads = await Promise.all(rsaPayloadsPromises);

    for (let i = 0; i < rsaPayloads.length; i++) {
        const rsaPayload = rsaPayloads[i];
        // Add file size (fixed uint32)
        const rsaPayloadSize = getPaddedUint32(rsaPayload.byteLength);
        await writeBinaryFile(outputFilePath, rsaPayloadSize, { append: true });

        // Add rsa wrapped key
        await writeBinaryFile(outputFilePath, rsaPayload, { append: true });
    }

    // Build AES payload
    const textEncoder = new TextEncoder();
    const encodedFileName = textEncoder.encode(fileName);
    const FILE_SIZE_BYTE_LENGTH = 1;
    const aesPayload = new Uint8Array(FILE_SIZE_BYTE_LENGTH + encodedFileName.byteLength + binInputFile.byteLength + ECDSA_SIG_LEN);
    let payloadOffset = 0;
    // Set file name size
    aesPayload[payloadOffset] = encodedFileName.byteLength;
    payloadOffset += FILE_SIZE_BYTE_LENGTH;
    // Set file name
    for (let i = 0; i < encodedFileName.byteLength; i++, payloadOffset++) {
        aesPayload[payloadOffset] = encodedFileName[i];
    }
    // Set file data
    for (let i = 0; i < binInputFile.byteLength; i++, payloadOffset++) {
        aesPayload[payloadOffset] = binInputFile[i];
    }

    // Sign file data
    const aesPayloadSignature = new Uint8Array(await window.crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        user.signingKeys.privateKey,
        binInputFile
    ));

    // Set payload signature
    for (let i = 0; i < aesPayloadSignature.byteLength; i++, payloadOffset++) {
        aesPayload[payloadOffset] = aesPayloadSignature[i];
    }

    // encrypt AES payload
    const encryptedAesPayload = await window.crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter: aesKey.ctr,
            length: 64
        },
        aesKey.key,
        aesPayload
    );

    // Add AES payload
    await writeBinaryFile(outputFilePath, encryptedAesPayload, { append: true });

    // Get all file data so far
    const nearFinishedFile = await readBinaryFile(outputFilePath);

    // Sign file data
    const fullFileSignature = new Uint8Array(await window.crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        user.signingKeys.privateKey,
        nearFinishedFile
    ));

    // Add final file signature
    return writeBinaryFile(outputFilePath, fullFileSignature, { append: true });
}

export async function EF_V0_DecryptFile(binInputFile: Uint8Array, expectedSender: Contact, user: User) {
    return new Promise<{ decryptedFile: ArrayBuffer, fileName: string, passedSignatureValidation: boolean }>(async (resolve, reject) => {

        // Minimum file size
        if (binInputFile.byteLength < 1 + 16 + 1 + 512 + (ECDSA_SIG_LEN * 2)) {
            reject("Invalid file size");
            return;
        }

        let fileReadOffset = 0;
        const fileEncryptionFormat = binInputFile[0];
        fileReadOffset += 1;

        if (fileEncryptionFormat !== EFFormat.V0) {
            reject("Invalid file encryption type");
            return;
        }

        const aesCtr = binInputFile.subarray(fileReadOffset, fileReadOffset + AES_CTR_NONCE_SIZE);
        fileReadOffset += AES_CTR_NONCE_SIZE;

        const rsaPayloadCnt = binInputFile[fileReadOffset];
        fileReadOffset += 1;

        if (rsaPayloadCnt === 0) {
            reject("Invalid recipient count");
            return;
        }

        let rsaPayloadsPromises = [];
        for (let i = 0; i < rsaPayloadCnt; i++) {
            let payloadSize = getUint32FromOffset(binInputFile, fileReadOffset);
            fileReadOffset += 4;

            const rsaPayload = binInputFile.subarray(fileReadOffset, fileReadOffset + payloadSize);
            fileReadOffset += payloadSize;

            rsaPayloadsPromises.push(window.crypto.subtle.unwrapKey(
                "raw",
                rsaPayload,
                user.encryptionKeys.privateKey,
                {
                    name: "RSA-OAEP"
                },
                {
                    name: "AES-CTR",
                    length: 256,
                },
                true,
                ["encrypt", "decrypt"]

            ));
        }

        const rsaPayloads = (await Promise.allSettled(rsaPayloadsPromises)).map(result => {
            if (result.status === "fulfilled") {
                return (result.value);
            } else {
                console.log(result.reason);
                return undefined;
            }
        });

        // Search through rsaPayloads to find a valid one
        const validRsaPayload = rsaPayloads.find(payload => payload !== undefined);

        if (!validRsaPayload) {
            reject("Message was not sent to this user. No valid RSA payload.");
            return;
        }

        // Rest of the file, excluding signature
        const encrypedAesPortionEnd = binInputFile.byteLength - ECDSA_SIG_LEN;
        const encryptedAesPortion = binInputFile.subarray(fileReadOffset, encrypedAesPortionEnd);

        const decryptedAesPortion = new Uint8Array(await window.crypto.subtle.decrypt(
            {
                name: "AES-CTR",
                counter: aesCtr,
                length: 64
            },
            validRsaPayload,
            encryptedAesPortion
        ));

        if (decryptedAesPortion) {
            let aesPortionOffset = 0;

            const fileNameLength = decryptedAesPortion[aesPortionOffset];
            aesPortionOffset += 1;
            const fileNameBin = decryptedAesPortion.subarray(aesPortionOffset, aesPortionOffset + fileNameLength);
            aesPortionOffset += fileNameLength;

            const textDecoder = new TextDecoder();
            const fileName = textDecoder.decode(fileNameBin);

            const endOfFileBin = decryptedAesPortion.byteLength - ECDSA_SIG_LEN;
            const fileBin = decryptedAesPortion.subarray(aesPortionOffset, endOfFileBin);

            if (!fileBin) {
                reject("Malformed file payload.");
                return;
            }

            // Validate full file signature
            // TODO need contact signing public key
            // const fullFileWasValid = VerifyBin(binInputFile, expectedSender.publicEncryptionKey);

            // Validate aes decrypted signature

            // File was successfully decrypted
            resolve({ decryptedFile: fileBin, fileName: fileName, passedSignatureValidation: true });
        } else {
            reject("Message did not pass integrity validation.");
            return;
        }
    });
}