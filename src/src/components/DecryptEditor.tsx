import { ask, open, save } from "@tauri-apps/api/dialog";
import { writeBinaryFile } from "@tauri-apps/api/fs";
import { sep } from "@tauri-apps/api/path";
import { useState } from "react";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { DecryptFile } from "../utils/crypto_utils";
import { EFFormat } from "../utils/key_utils";
import { GetContactFromUser } from "../utils/user_utils";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { NotificationCore } from "./Notification";

interface DecryptEditorProps {
    user: User | undefined,
    sendNotification: (newNotification: NotificationCore) => void;
}

export function DecryptEditor(props: DecryptEditorProps) {
    const [inputFiles, setInputFiles] = useState<string[]>([]);
    const [selectedContact, setselectedContact] = useState<number | undefined>(undefined);

    const noFilesSelected = !inputFiles || inputFiles.length === 0;
    const noContactSelected = selectedContact === undefined;

    const decryptSelFiles = () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            props.sendNotification(
                {
                    msg: `No files selected`,
                    type: "fail"
                }
            );
            return;
        }

        inputFiles.forEach(async file => {
            if (props.user && selectedContact !== undefined) {
                let contactsToDecryptFor = selectedContact === 0 ? GetContactFromUser(props.user) : props.user.contacts[selectedContact - 1];

                DecryptFile(EFFormat.V0, file, contactsToDecryptFor, props.user).then((fileDetails) => {
                    const saveDecryptedFile = () => {
                        let splitPath = file.split(sep);
                        // Remove file name
                        splitPath = splitPath.splice(-1);
                        // Add new file name
                        splitPath.push(fileDetails.fileName);
                        const pathToNewFile = splitPath.join(sep);

                        save({
                            title: `Decrypting ${file}`,
                            defaultPath: pathToNewFile
                        }).then(path => {
                            if (path) {
                                writeBinaryFile(path, fileDetails.decryptedFile).then(() => {
                                    props.sendNotification(
                                        {
                                            msg: `Decryption successful`,
                                            type: "success"
                                        }
                                    );
                                });
                            }
                        });
                    }


                    if (fileDetails.passedSignatureValidation) {
                        saveDecryptedFile();
                    } else {
                        // TODO give distinct error for when the signatures mismatch too
                        ask(`Decrypted file ${fileDetails.fileName} was not encrypted by ${contactsToDecryptFor.name} do you still want to save the file?`,
                            { okLabel: "Save Potentially Unsafe File", cancelLabel: "Cancel", title: `Warning: File Encrypted By Unexpected Sender` })
                            .then(confirmed => {
                                if (confirmed) {
                                    saveDecryptedFile();
                                }
                            });
                    }
                }).catch(() => {                    
                    props.sendNotification(
                        {
                            msg: `Decryption failed: ${file}`,
                            type: "fail"
                        }
                    );
                })
            }
        });

    }

    const getFileList = () => {
        if (noFilesSelected) {
            return <li>No files selected</li>
        }

        return (
            Array.from(inputFiles).map(file => (<li id={file}>{file}</li>))
        );
    }

    const getContactList = () => {
        if (props.user === undefined) {
            return;
        }

        const allContacts = [GetContactFromUser(props.user)];
        allContacts[0].name = `${allContacts[0].name} (Me)`
        allContacts.push(...props.user.contacts);

        return (
            <ul>
                {Array.from(allContacts).map((contact, idx) => (
                    <li id={`${contact.name}-${contact.note}`}>
                        <ContactRow
                            contact={contact}
                            isSelected={selectedContact === idx}
                            setSelected={(newSelection) => {
                                if (newSelection) {
                                    setselectedContact(idx);
                                } else {
                                    setselectedContact(undefined);
                                }
                            }}
                        />
                    </li>))}
            </ul>
        )
    }

    return (
        <div className="column" style={{ width: "100%" }}>
            <LabeledOutlineContainer label="Selected Files" fitContentWidth={false}>
                <div className="column">
                    <ul style={{ minHeight: "100px" }}>
                        {getFileList()}
                    </ul>
                    <button onClick={async () => {
                        const selected = await open({
                            multiple: true
                        });

                        if (Array.isArray(selected)) {
                            // user selected multiple files
                            setInputFiles(selected);
                        } else if (selected === null) {
                            // user cancelled the selection
                            setInputFiles([]);
                        } else {
                            // user selected a single file
                            setInputFiles([selected]);
                        }
                    }}>Browse</button>
                </div>
            </LabeledOutlineContainer>
            <div className="column" style={{ maxWidth: 350 }}>
                <LabeledOutlineContainer label="Expected File Sender">
                    {getContactList()}
                </LabeledOutlineContainer>
            </div>
            <div className="row">
                <button onClick={() => decryptSelFiles()} disabled={noFilesSelected || noContactSelected}>Decrypt</button>
            </div>
        </div>
    );
}

interface ContactRowProps {
    contact: Contact;
    isSelected: boolean;
    setSelected: (isSelected: boolean) => void;
}

function ContactRow(props: ContactRowProps) {
    return (
        <div className="row interactive" style={{ justifyContent: "space-between" }} onClick={() => props.setSelected(!props.isSelected)}>
            <div className="row">
                <div>{props.contact.name}</div>
                {props.contact.note !== undefined && props.contact.note.trim() !== "" ? <div><i>- {props.contact.note}</i></div> : undefined}
            </div>
            <div>
                <input type="checkbox" checked={props.isSelected}></input>
            </div>
        </div>
    )
}