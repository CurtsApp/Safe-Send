import { readBinaryFile } from "@tauri-apps/api/fs";
import { sep } from "@tauri-apps/api/path";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { EF_V0_DecryptFile, EF_V0_EncryptFile } from "./EF_V0_utils";
import { AES_CTR_NONCE_SIZE, EFFormat } from "./key_utils";

// Input .sf file, is the decrypted original payload with the signature appended to the end
export function VerifyBin(inputBin: Uint8Array, publicKey: CryptoKey) {
    const endOfFile = inputBin.length - ECDSA_SIG_LEN;
    const decryptedOriginalFile = inputBin.subarray(0, endOfFile);
    const signature = inputBin.subarray(endOfFile);
    return window.crypto.subtle.verify(
        {
            name: "ECDSA",
            hash: "SHA-256",
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

// ECDSA Signature length is always 96 bytes with current key parameters
export const ECDSA_SIG_LEN = 96;
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

export const USER_PROFILE_SALT_LENGTH = 16;
export function GenerateUserProfileAesSalt() {
    return window.crypto.getRandomValues(new Uint8Array(USER_PROFILE_SALT_LENGTH));
}

export const USER_PROFILE_IV_LENGTH = 12;
export function GenerateUserProfileIV() {
    return window.crypto.getRandomValues(new Uint8Array(USER_PROFILE_IV_LENGTH));
}

export function GenerateAesPasswordKeyNewSalt(password: string) {
    return new Promise<{key: CryptoKey, salt: Uint8Array}>((resolve, reject) => {
        const salt = GenerateUserProfileAesSalt();
        GenerateAesPasswordKey(password, salt).then(key => {
            resolve({
                key,
                salt
            });
        })
    })

}

export async function GenerateAesPasswordKey(password: string, salt: Uint8Array) {
    const textEncoder = new TextEncoder();
    const pbkKey = await window.crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 1000000,
            hash: "SHA-256",
        },
        pbkKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
    );

    return key;
}