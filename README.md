# Safe Send

Safe Send is a desktop application for securely encrypting and decrypting files that can be sent over established public communication channels.

Modern communication platforms come with many conveniences and features at the cost requiring the user to trust the platform to secure their messages. There are situations where a message is too important to require trust or when sensitive files must be sent using older technologies like SMS or email.

## Use cases
- Sharing sensitive tax documents with a family member
- Sharing sensitive images with a medical provider
- Storing sensitive files on a cloud storage platform for you to download at a later date

## How to use
1. Both the file sender and receiver install Safe Send from the precompiled binaries for their operating system
2. Both the file sender and receiver create a user profile with a password (if this password is lost it can NOT be recovered)
3. Both the file sender and receiver share their contact details with each other (.ssc file)
4. The file sender encrypts the file after selected all of their contacts they want to be able to open it
   - Files can be encrypted for yourself
   - Files can be encrypted for multiple contacts. A single file is generated that all of the selected contacts can decrypt.
5. The file sender sends the encrypted file (.ef file) to the receiver over any established communication platform
6. The receiver decrypts the file, selecting sender as the expected sender of the file will verify the file was created by them.

## Security

No internet required. Your keys and files stay on your device at all times. Any file sharing is initiated by the user manually outside of the Safe Send application. 

All user contacts and encrypted files are secured using 128 bit AES encryption. All encryption is performed using the system's Web View's implementation of [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).

All Safe Send encrypted files are double signed by their creator. Both the unencrypted file payload is signed and the encrypted file payload with it's intended recipients is also signed. This double signing technique prevents surreptitious forwarding and gives the file recipient the assurance that their expected contact created the file and intended for them to receive it.

User private keys are NEVER saved unencrypted to file storage. They are stored in a user profile which is secured with the user's password (this password can NOT be recovered if lost) using a salted 128 bit AES-GCM encryption, the GCM encryption guarantees that your user profile, your private keys and saved contacts, is not modified outside of Safe Send.

### What is not guaranteed?

Safe Send can not guarantee that the shared contact card you received actually came from the person you think it did. This can be mitigated by sharing contact details over previously used communication channels or exchanged in person via flash drive for maximum assurance.

Safe Send can not protect your user profile if it is secured using a compromised or re-used password. This can be mitigated by using a unique password for your Safe Send user profile.

Safe Send does not create anonymous messages. The file content is private; it can only be read by the intended recipients. However, each message's author is revealed by the signature of the file. This can not be mitigated, Safe Send's intended use case is for sending files over public communication channels which would immediately deanonymize both the file sender and receiver. There is no benefit to supporting anonymous options, if this is required a different tool should be used.

## Install

The release folder contains precompiled installers.

## Build 

```bash
npm run tauri build
```

## Run locally

```bash
npm run tauri dev
```


