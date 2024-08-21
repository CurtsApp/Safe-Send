/* DO NOT CHANGE ENUM VALUES EVER */
/* they are required to look up historical key parameters */
export enum EFFormat {
    V0 = 0, /* AES-CTR encrypted payload, with the wrapped key delivered in 
               RSA-OAEP. Double signed with ECDSA.          */

}

export const AES_CTR_NONCE_SIZE = 16;
