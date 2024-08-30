import { open, save } from "@tauri-apps/api/dialog";
import { useState } from "react";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { EncryptFile } from "../utils/crypto_utils";
import { EFFormat } from "../utils/key_utils";
import { GetContactFromUser } from "../utils/user_utils";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { NotificationCore } from "./Notification";

interface PackagingEditorProps {
    user: User | undefined,
    sendNotification: (newNotification: NotificationCore) => void;

    inputFiles: string[];
    setInputFiles: (updatedInputFiles: string[]) => void;
}

export function PackagingEditor(props: PackagingEditorProps) {
    const {inputFiles, setInputFiles} = props;
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

    const noFilesSelected = !inputFiles || inputFiles.length === 0;
    const noContactSelected = selectedContacts.length === 0;

    const encryptSelFiles = async () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            props.sendNotification(
                {
                    msg: `No files selected`,
                    type: "fail"
                }
            );
            return;
        }

        if (props.user) {
            // @ts-ignore
            let contactsToEncryptFor = selectedContacts.map(selIdx => {
                if (selIdx === 0) {
                    // @ts-ignore
                    return GetContactFromUser(props.user);
                } else {
                    // @ts-ignore
                    return props.user.contacts[selIdx - 1]
                }

            });
            contactsToEncryptFor = contactsToEncryptFor.filter(contact => contact !== undefined);

            for (const i in inputFiles) {
                const file = inputFiles[i];
                const path = await save({
                    filters: [
                        {
                            name: 'Safe File',
                            extensions: ["ef"],
                        },
                    ],
                    title: `Output: Encrypting ${file}`
                });

                if (path) {
                    EncryptFile(EFFormat.V0, file, path, contactsToEncryptFor, props.user).then(() => {
                        props.sendNotification(
                            {
                                msg: `Encryption successful`,
                                type: "success"
                            }
                        )
                    }
                    ).catch(() => {
                        props.sendNotification(
                            {
                                msg: `Encryption failed: ${file}`,
                                type: "fail"
                            }
                        );
                    });
                }
            }
        }
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
                            isSelected={selectedContacts.find((contactIdx) => contactIdx === idx) !== undefined}
                            setSelected={(newSelection) => {
                                if (newSelection) {
                                    selectedContacts.push(idx);
                                    setSelectedContacts([...selectedContacts]);
                                } else {
                                    let idxToRemove = selectedContacts.findIndex((contactIdx) => contactIdx === idx);
                                    selectedContacts.splice(idxToRemove, 1);
                                    setSelectedContacts([...selectedContacts]);
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
                <LabeledOutlineContainer label="Encrypt Files For">
                    {getContactList()}
                </LabeledOutlineContainer>
            </div>
            <div className="row">
                <button onClick={() => encryptSelFiles()} disabled={noFilesSelected || noContactSelected}>Encrypt</button>
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
                <input type="checkbox" checked={props.isSelected} readOnly></input>
            </div>
        </div>
    )
}