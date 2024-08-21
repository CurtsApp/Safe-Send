import { readBinaryFile, writeBinaryFile } from "@tauri-apps/api/fs";
import { sep } from "@tauri-apps/api/path";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { EF_V0_DecryptFile, EF_V0_EncryptFile } from "./EF_V0_utils";
import { decodeBytesToJSON, getUint32FromOffset, hasAllKeys } from "./general_utils";
import { AES_CTR_NONCE_SIZE, EFFormat } from "./key_utils";

export const ECDSA_SIG_LEN = 96;

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
export function VerifyBin(inputBin: Uint8Array, publicKey: CryptoKey) {
    const endOfFile = inputBin.length - SIGNATURE_LENGTH;
    const decryptedOriginalFile = inputBin.subarray(0, endOfFile);
    const signature = inputBin.subarray(endOfFile);
    return window.crypto.subtle.verify(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        publicKey,
        signature,
        decryptedOriginalFile
    );
}




export async function EncryptFile(fileFormat: EFFormat, inputFilePath: string, outputFilePath: string, recipients: Contact[], user: User) {
    let pathSplit = inputFilePath.split(sep);
    let fileName = "";
    if (pathSplit.length > 0) {
        fileName = pathSplit[pathSplit.length - 1];
    }

    const binInputFile = await readBinaryFile(inputFilePath);

    switch (fileFormat) {
        case EFFormat.V0:
            EF_V0_EncryptFile(binInputFile, fileName, outputFilePath, recipients, user);
            break;
    }
}

export async function DecryptFile(fileFormat: EFFormat, inputFilePath: string, expectedSender: Contact, user: User) {
    const binInputFile = await readBinaryFile(inputFilePath);

    switch (fileFormat) {
        case EFFormat.V0:
            return EF_V0_DecryptFile(binInputFile, expectedSender, user);
    }
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
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
}

/*
SINGLE USE KEY ONLY, ctr value must changed if key is reused.
This function is for generating a single use key
*/
export async function GenerateAesCtrSingleUseKey() {
    const key = await window.crypto.subtle.generateKey(
        {
            name: "AES-CTR",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
    const ctr = window.crypto.getRandomValues(new Uint8Array(AES_CTR_NONCE_SIZE));
    return {
        key,
        ctr
    };
}