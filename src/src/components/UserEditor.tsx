import { dialog } from "@tauri-apps/api";
import { ask, message, open, save } from "@tauri-apps/api/dialog";
import { FileEntry, readDir } from "@tauri-apps/api/fs";
import { useRef, useState } from "react";
import { User } from "../interfaces/User";
import { GenerateAesPasswordKeyNewSalt, GenerateEncryptionKey, GenerateSigningKey } from "../utils/crypto_utils";
import { getFirstString, stringSort } from "../utils/general_utils";
import { DeleteFile, GetUserFromPath, GetUserProfilePath, SaveUser, USER_PROFILE_BASE_DIR, USER_PROFILE_DIR } from "../utils/user_utils";
import { LabeledInputField } from "./LabeledInputField";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { NotificationCore } from "./Notification";

interface UserEditorProps {
    user: User | undefined,
    updateUser: (user: User | undefined) => void;
    sendNotification: (newNotification: NotificationCore) => void;
}

export function UserEditor(props: UserEditorProps) {
    const [profiles, setProfiles] = useState<FileEntry[]>();
    const [profilesUpdating, setProfilesUpdating] = useState(false);
    const [passwordPromptTitle, setPasswordPromptTitle] = useState("");
    const [password, setPassword] = useState("");
    const [onPasswordEntry, setOnPasswordEntry] = useState<(password: string) => void>();
    const importProfileButton = <button onClick={() => importUserProfile()}>Import Profile</button>;
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    const showPasswordPrompt = (title: string, onPasswordEntry: (password: string) => void) => {
        setPasswordPromptTitle(title);
        setPassword("");
        dialogRef?.current?.showModal();
        setOnPasswordEntry(() => onPasswordEntry);
    }

    const hidePasswordPrompt = () => {
        dialogRef?.current?.close();
    }

    if (!profilesUpdating) {
        setProfilesUpdating(true);
        readDir(USER_PROFILE_DIR, USER_PROFILE_BASE_DIR).then(docs => setProfiles(docs.sort((a, b) => stringSort(a.name, b.name))));
    }

    if (!props.user) {
        return (
            <div className="column centered">
                <LabeledOutlineContainer label="User Profiles - Log in">
                    <div className="column">
                        {profiles && profiles.length > 0 ?
                            profiles.map(profile => <button key={profile.name} onClick={() => {
                                let potentialUserName = profile.name?.split(".")[0];
                                if (potentialUserName) {
                                    showPasswordPrompt(
                                        potentialUserName,
                                        (password) => {
                                            attemptLogIn(potentialUserName, password);
                                        }
                                    )
                                }
                            }}>{profile.name?.split(".")[0] || profile.name}</button>)
                            : undefined}
                    </div>
                </LabeledOutlineContainer>
                <div className="row">
                    <button onClick={() => createNewUserProfile()}>New Profile</button>
                    {importProfileButton}
                </div>
                <dialog ref={dialogRef}>
                    <form className="column">
                        <div style={{ textAlign: "center" }}>{passwordPromptTitle}</div>
                        <LabeledInputField
                            fieldValue={password}
                            label="Password"
                            updateStringValue={(updatedValue) => setPassword(updatedValue)}
                            fieldType="password"
                        />
                        <div className="row">
                            <button onClick={() => hidePasswordPrompt()}>Cancel</button>
                            <button
                                type="submit"
                                onClick={(e) => {
                                    if (onPasswordEntry) {
                                        onPasswordEntry(password)
                                    }
                                    e.preventDefault();
                                }}>Sign In</button>
                        </div>
                    </form>
                </dialog>
            </div>
        )
    }

    return (
        <div className="centered">
            <LabeledOutlineContainer label="My Profile">
                <div className="column">
                    <LabeledInputField
                        fieldValue={props.user.name || ""}
                        label="Name"
                        updateStringValue={(updatedName) => {
                            if (props.user) {
                                updateUserData({ ...props.user, name: updatedName })
                            }
                        }}
                    />
                    <LabeledInputField
                        fieldValue={props.user.note || ""}
                        label="Note"
                        updateStringValue={(updatedNote) => {
                            if (props.user) {
                                updateUserData({ ...props.user, note: updatedNote })
                            }
                        }}
                    />

                    <div className="row">
                        <button onClick={() => exportUserProfile()}>Share Profile</button>
                        <button onClick={() => logOut()}>Sign Out</button>
                        <button className="danger" onClick={() => deleteCurrentProfile()}>Delete Profile</button>
                    </div>

                </div >
            </LabeledOutlineContainer>
        </div>
    );

    function attemptLogIn(userName: string, password: string) {
        if (userName) {
            const userFilePath = GetUserProfilePath(userName);

            GetUserFromPath(userFilePath, password, USER_PROFILE_BASE_DIR).then(async user => {
                if (user) {
                    // Force user name to match file name, this will fix any sync issues if they happened
                    user.name = userName;
                    props.updateUser(user);
                    hidePasswordPrompt();
                    props.sendNotification(
                        {
                            msg: `Signed In`,
                            type: "success"
                        }
                    );
                } else {
                    props.sendNotification(
                        {
                            msg: `Sign in failed`,
                            type: "fail"
                        }
                    );
                }
            }).catch(() => {
                props.sendNotification(
                    {
                        msg: `Sign in failed`,
                        type: "fail"
                    }
                );
            })
        } else {
            props.sendNotification(
                {
                    msg: `Sign in failed: No user provided`,
                    type: "fail"
                }
            );
        }
    }

    function logOut() {
        // Refresh any profile names
        setProfilesUpdating(false);
        props.updateUser(undefined);
    }

    function updateUserData(user: User) {
        props.updateUser(user);
    }

    function createNewUserProfile() {
        showPasswordPrompt(
            "New User",
            (password) => {
                let signingKey = GenerateSigningKey();
                let encryptKey = GenerateEncryptionKey();
                let profileEncryptionKey = GenerateAesPasswordKeyNewSalt(password);

                Promise.all([signingKey, encryptKey, profileEncryptionKey]).then((values) => {
                    updateUserData({ name: "New User", note: "", encryptionKeys: values[1], signingKeys: values[0], contacts: [], userDataEncryptionKey: values[2].key, profileSalt: values[2].salt });
                }).catch(() => {
                    props.sendNotification(
                        {
                            msg: `New User Profile Generation Failed`,
                            type: "fail"
                        }
                    );
                });
            }
        )
    }

    async function importUserProfile() {
        const selected = await open({
            filters: [
                {
                    name: "User Profile",
                    extensions: ["up"]
                }
            ]
        });

        let path = getFirstString(selected);

        if (path) {
            showPasswordPrompt(
                "New User",
                (password) => {
                    GetUserFromPath(path, password).then(user => {
                        if (user) {
                            updateUserData(user);
                        } else {
                            props.sendNotification(
                                {
                                    msg: `Failed to import user profile: ${path}`,
                                    type: "fail"
                                }
                            );
                        }
                    }).catch(() => {
                        props.sendNotification(
                            {
                                msg: `Failed to import user profile: ${path}`,
                                type: "fail"
                            }
                        );
                    })
                }
            )
        }
    }

    async function exportUserProfile() {
        const path = await save({
            filters: [
                {
                    name: "User Profile",
                    extensions: ["up"]
                }
            ],
            title: "Decrypted File",
            defaultPath: props.user ? props.user.name : undefined
        });

        if (path && props.user) {
            SaveUser(props.user, path).catch(() => {
                props.sendNotification(
                    {
                        msg: `Failed to save user profile: ${props.user?.name}`,
                        type: "fail"
                    }
                );
            });
        }
    }

    function deleteCurrentProfile() {
        ask(`Are you sure you want to delete '${props.user?.name}'?`,
            { okLabel: "Delete User", cancelLabel: "Cancel", title: `Delete ${props.user?.name}` })
            .then(confirmed => {
                if (confirmed && props.user) {
                    DeleteFile(GetUserProfilePath(props.user.name), USER_PROFILE_BASE_DIR);
                    logOut();
                }
            })
    }
}