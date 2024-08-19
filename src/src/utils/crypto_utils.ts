import { readBinaryFile, writeBinaryFile } from "@tauri-apps/api/fs";
import { delimiter, sep } from "@tauri-apps/api/path";
import { Contact } from "../interfaces/Contact";
import { decodeBytesToJSON, getPaddedUint32, getUint32FromOffset, hasAllKeys } from "./general_utils";
import { AES_0_NONCE_SIZE, KeyType } from "./key_utils";
import { User } from "../interfaces/User";

export function SignFile(inputFilePath: string, outputFilePath: string, privateKey: CryptoKey) {
    return new Promise<boolean>((resolve, reject) => {
        readBinaryFile(inputFilePath).then(binInputFile => {
            window.crypto.subtle.sign(
                {
                    name: "ECDSA",
                    hash: { name: "SHA-256" },
                },
                privateKey,
                binInputFile
            ).then(signedInputFile => {
                if (signedInputFile.byteLength !== SIGNATURE_LENGTH) {
                    reject(`Invalid signature length ${signedInputFile.byteLength}`);
                } else {
                    // Copy original file
                    writeBinaryFile(outputFilePath, binInputFile).then(() => {
                        // Append signature to the end
                        writeBinaryFile(outputFilePath, signedInputFile, { append: true }).then(() => resolve(true));
                    })
                }

            })
        })
    });
}

// Input .sf file, is the decrypted original payload with the signature appended to the end
// Signature is always 96 bytes
const SIGNATURE_LENGTH = 96;
export function VerifyFile(inputFilePath: string, publicKey: CryptoKey) {
    return new Promise<boolean>((resolve, reject) => {
        readBinaryFile(inputFilePath).then(binInputFile => {
            let endOfFile = binInputFile.length - SIGNATURE_LENGTH;
            let decryptedOriginalFile = binInputFile.slice(0, endOfFile);
            let signature = binInputFile.slice(endOfFile);
            window.crypto.subtle.verify(
                {
                    name: "ECDSA",
                    hash: { name: "SHA-256" },
                },
                publicKey,
                signature,
                decryptedOriginalFile
            ).then(suc => resolve(suc));
        })
    });
}

/*
Encrypted file structure

Size of file metadata (fixed uint32)
file metadata (JSON)
    [ RSA Encryption type, settings, salt, size, filename ] one for each member of the message
    AES GCM Encryption type, settings, salt (no size)
RSA encrypted payload (one for each member of message) - Payload is AES key
AES Encrypted payload
    original file (no size, till end of file)
*/



interface EncryptedFileMetadata {
    rsaDetails: RSADetails[];
    aesDetails: AESDetails;
}

interface RSADetails {
    keyType: KeyType;
    size: number;
}

interface AESDetails {
    keyType: KeyType;
}

const DFLT_AES_DETAILS: AESDetails = {
    keyType: KeyType.AES_0
}

interface RSAPayload {
    fileName: string;
    aesNonce: Uint8Array;
    aesKey: JsonWebKey;
}

export async function EncryptFile(inputFilePath: string, outputFilePath: string, recipients: Contact[]) {
    let pathSplit = inputFilePath.split(sep);
    let fileName = "";
    if (pathSplit.length > 0) {
        fileName = pathSplit[pathSplit.length - 1];
    }

    const aesKey = await GenerateAESKey();
    const rsaPayloadsPromises = recipients.map(async recipient => {
        let payload: RSAPayload = {
            fileName: fileName,
            aesKey: await crypto.subtle.exportKey("jwk", aesKey.key),
            aesNonce: aesKey.iv
        };

        const textEncoder = new TextEncoder();
        const payloadBin = textEncoder.encode(JSON.stringify(payload));
        const encryptedPayload = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            recipient.publicEncryptionKey,
            payloadBin
        );

        return {
            size: encryptedPayload.byteLength,
            encryptPayload: encryptedPayload
        }
    });

    const rsaPayloads = await Promise.all(rsaPayloadsPromises);

    const fileMetaData: Partial<EncryptedFileMetadata> = {};
    fileMetaData.rsaDetails = recipients.map((recipient, idx) => {
        const rsaDetails = GetRSADetailsFromContact(recipient)
        rsaDetails.size = rsaPayloads[idx].size;
        return rsaDetails;
    });
    fileMetaData.aesDetails = DFLT_AES_DETAILS;
    const textEncoder = new TextEncoder();
    const finalFileMetdata = textEncoder.encode(JSON.stringify(fileMetaData));
    const packagedMetaDataSize = getPaddedUint32(finalFileMetdata.byteLength);

    const binInputFile = await readBinaryFile(inputFilePath);

    const encryptedInputFile = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: aesKey.iv
        },
        aesKey.key,
        binInputFile
    );

    // Add file metadata size (fixed uint32)
    await writeBinaryFile(outputFilePath, packagedMetaDataSize);

    // Add file metadata
    await writeBinaryFile(outputFilePath, finalFileMetdata, { append: true });

    // Add RSA keys   
    await Promise.all(rsaPayloads.map(async rsaPayload => {
        await writeBinaryFile(outputFilePath, rsaPayload.encryptPayload, { append: true })
    }));

    // Add AES keys
    return writeBinaryFile(outputFilePath, encryptedInputFile, { append: true });
}

function GetRSADetailsFromContact(contact: Contact): RSADetails {
    return {
        keyType: KeyType.RSA_0,
        size: 0
    };
}

export function DecryptFile(inputFilePath: string, user: User) {
    return new Promise<{decryptedFile: ArrayBuffer, fileName: string}>(async (resolve, reject) => {
        const binInputFile = await readBinaryFile(inputFilePath);

        if (binInputFile.byteLength < 4) {
            reject("Invalid file size");
            return;
        }

        let fileReadOffset = 0;
        const fileMetaDataSize = getUint32FromOffset(binInputFile, fileReadOffset);
        fileReadOffset += 4;

        const fileMetaData = decodeBytesToJSON(binInputFile, fileReadOffset, fileMetaDataSize) as EncryptedFileMetadata;
        if (fileMetaData === undefined || !hasAllKeys<EncryptedFileMetadata>(fileMetaData, ["aesDetails", "rsaDetails"])) {
            reject("Invalid file metadata");
            return;
        }
        fileReadOffset += fileMetaDataSize;

        if (fileMetaData.rsaDetails.length === 0) {
            reject("Invalid rsa detail length");
            return;
        }

        const rsaPayloads = await Promise.all(fileMetaData.rsaDetails.map(async rsaDetail => {
            const subArray = binInputFile.subarray(fileReadOffset, fileReadOffset + rsaDetail.size);
            fileReadOffset += rsaDetail.size;
            const decryptedBin = await DecryptByKeyType(subArray, rsaDetail.keyType, user.encryptionKeys.privateKey);

            let rsaPayload;
            if (decryptedBin) {
                const decryptedBinUint8 = new Uint8Array(decryptedBin);
                rsaPayload = decodeBytesToJSON(decryptedBinUint8, 0, decryptedBinUint8.byteLength) as RSAPayload;
            }
            return rsaPayload;
        }));

        // Search through rsaPayloads to find a valid one
        const validRsaPayload = rsaPayloads.find(payload => payload !== undefined && hasAllKeys<RSAPayload>(payload, ["aesKey", "aesNonce", "fileName"]));

        if (!validRsaPayload) {
            reject("Message was not sent to this user. No valid RSA payload.");
            return;
        }

        // For some reason the uint8 array isn't parsed as a uint8 array when it comes back from JSON
        // The decrypt will fail if it isn't
        const typedIV = new Uint8Array(AES_0_NONCE_SIZE);
        for(let i = 0; i < AES_0_NONCE_SIZE; i++) {            
            typedIV[i] = validRsaPayload?.aesNonce[i];
        }

        // Rest of the file
        const encryptedAesPortion = binInputFile.subarray(fileReadOffset);
        const aesKey = await crypto.subtle.importKey(
            "jwk",
            validRsaPayload.aesKey,
            {
                name: "AES-GCM"
            },
            true,
            ["decrypt"]
        );
        const decryptedAesPortion = await DecryptByKeyType(encryptedAesPortion, fileMetaData.aesDetails.keyType, aesKey, typedIV);

        if(decryptedAesPortion) {
            // File was successfully decrypted
            resolve({decryptedFile: decryptedAesPortion, fileName: validRsaPayload.fileName});
        } else {
            reject("Message did not pass integrity validation.");
            return;
        }
    });
}

export function GenerateSigningKey() {
    return window.crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-384"
        },
        true,
        ["sign", "verify"]);
}

export function GenerateEncryptionKey() {
    return window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]);
}

export async function GenerateAESKey() {
    const key = await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(AES_0_NONCE_SIZE));
    return {
        key: key,
        iv: iv
    };
}

async function DecryptByKeyType(encryptedData: Uint8Array, keyType: KeyType, key: CryptoKey, iv?: Uint8Array): Promise<ArrayBuffer | undefined> {
    let decryptedData;
    switch (keyType) {
        case KeyType.RSA_0:
            decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP",
                },
                key,
                encryptedData
            );
            break;

        case KeyType.AES_0:
            decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM", 
                    iv
                },
                key,
                encryptedData
            );
            break;
    }

    return decryptedData;
}