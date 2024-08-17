/* DO NOT CHANGE ENUM VALUES EVER */
/* they are required to look up historical key parameters */
export enum KeyType {
    RSA_0 = 0, /*   name: "RSA-OAEP",
                    modulusLength: 4096,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: "SHA-256" */
    AES_0 = 1, // AES-GCM
    ECDSA_0 = 2, /* name: "ECDSA",
                    namedCurve: "P-384" */
}

