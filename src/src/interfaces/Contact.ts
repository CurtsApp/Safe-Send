export interface Contact {
    name: string;
    note?: string;

    publicEncryptionKey: CryptoKey;
    publicSigningKey: CryptoKey;
}

export interface SavedContact {
    name: string;
    note?: string;

    publicEncryptionKey: JsonWebKey;
    publicSigningKey: JsonWebKey;
}