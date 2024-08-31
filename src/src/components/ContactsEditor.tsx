import { ask, open, save } from "@tauri-apps/api/dialog";
import { useState } from "react";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { ExportContact, ImportContact } from "../utils/contact_utils";
import { getFirstString } from "../utils/general_utils";
import { GetContactFromUser } from "../utils/user_utils";
import { LabeledInputField } from "./LabeledInputField";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { NotificationCore } from "./Notification";

interface ContactsEditorProps {
    user: User | undefined;
    updateContacts: (newContacts: Contact[]) => void;
    sendNotification: (newNotification: NotificationCore) => void;
}

export function ContactsEditor(props: ContactsEditorProps) {
    const [searchQuery, setSearchQuery] = useState("");

    if (!props.user) {
        return <div>Please sign in</div>;
    }

    // Updating the user will trigger re-render, so this isn't state
    let contacts = [...props.user.contacts];

    const handleDeleteContact = (listIdx: number) => {
        ask(`Are you sure you want to delete '${contacts[listIdx].name}'?`,
            { okLabel: "Delete Contact", cancelLabel: "Cancel", title: `Delete ${contacts[listIdx].name}` })
            .then(confirmed => {
                if (confirmed) {
                    contacts.splice(listIdx, 1)
                    props.updateContacts(contacts);
                }
            });
    };

    const handleUpdateContact = (listIdx: number, key: keyof Contact, value: string) => {
        contacts[listIdx] = { ...contacts[listIdx], [key]: value };
        props.updateContacts(contacts);
    };

    const handleImportContact = async () => {
        const selected = await open({ title: "Import Contact", filters: [{ extensions: ["ssc"], name: "Safe Send Contact" }] });
        let path = getFirstString(selected);
        if (path) {
            ImportContact([path], contacts, props.updateContacts, props.sendNotification);
        }
    };

    const handleExportContact = async (contact: Contact) => {
        let path = await save({ defaultPath: `${contact.name}.ssc`, title: "Share My Contact", filters: [{ extensions: ["ssc"], name: "Safe Send Contact" }] });
        if (path) {
            ExportContact(contact, path).then(() => {
                props.sendNotification(
                    {
                        msg: `Contact shared`,
                        type: "success"
                    }
                );
            });
        }
    };

    let visibleContacts = contacts.filter((contact) => {
        let query = searchQuery.trim();
        if (query === "") {
            return true;
        }
        return contact.name.includes(query) || contact.note?.includes(query);
    })

    return (
        <div className="column fillWidth">
            <div className="row centered" style={{ maxHeight: 100 }}>
                <button onClick={handleImportContact}>Add Contact</button>
                <button onClick={() => props.user ? handleExportContact(GetContactFromUser(props.user)) : undefined}>Share My Contact</button>
            </div>
            <LabeledOutlineContainer label={"Contacts"} fitContentWidth={false}>
                <div className="column">
                    <div style={{ marginLeft: "0.6em" }}>
                        <LabeledInputField
                            label={"Search"}
                            fieldValue={searchQuery}
                            updateStringValue={(updatedValue) => setSearchQuery(updatedValue)} />
                    </div>
                    {visibleContacts.length === 0 ?
                        <div>No contacts found</div>
                        : <ul key="contactsList" className="row" style={{ listStyleType: 'none', padding: 0, flexWrap: "wrap", rowGap: "0.6em", justifyContent: "flex-start" }}>
                            {visibleContacts.map((contact, idx) => (
                                <ContactTile
                                    key={idx.toString()}
                                    contact={contact}
                                    updateName={(updatedValue) => handleUpdateContact(idx, 'name', updatedValue)}
                                    updateNote={(updatedValue) => handleUpdateContact(idx, 'note', updatedValue)}
                                    export={() => handleExportContact(contacts[idx])}
                                    delete={() => handleDeleteContact(idx)}
                                />
                            ))}
                        </ul>}
                </div>
            </LabeledOutlineContainer>

        </div>
    );
}

interface ContactTileProps {
    contact: Contact;
    key: string;
    updateName: (newName: string) => void;
    updateNote: (newName: string) => void;
    export: () => void;
    delete: () => void;
}
function ContactTile(props: ContactTileProps) {
    return (
        <li key={props.key} className="column outlineContainer">
            <LabeledInputField
                label={"Name"}
                fieldValue={props.contact.name}
                updateStringValue={(updatedValue) => props.updateName(updatedValue)} />
            <LabeledInputField
                label={"Note"}
                fieldValue={props.contact.note || ""}
                updateStringValue={(updatedValue) => props.updateNote(updatedValue)} />
            <div className="row">
                <button onClick={() => props.export()}>
                    Share
                </button>
                <button className="danger" onClick={() => props.delete()}>
                    Delete
                </button>
            </div>
        </li>
    )
}