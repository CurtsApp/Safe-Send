import { dialog } from "@tauri-apps/api";
import { ask, message, open, save } from "@tauri-apps/api/dialog";
import { FileEntry, readDir } from "@tauri-apps/api/fs";
import { useRef, useState } from "react";
import { User } from "../interfaces/User";
import { GenerateEncryptionKey, GenerateSigningKey } from "../utils/crypto_utils";
import { getFirstString, stringSort } from "../utils/general_utils";
import { DeleteFile, GetUserFromPath, GetUserProfilePath, SaveUser, USER_PROFILE_BASE_DIR, USER_PROFILE_DIR } from "../utils/user_utils";

interface UserEditorProps {
    user: User | undefined,
    updateUser: (user: User | undefined) => void;
}

export function UserEditor(props: UserEditorProps) {
    const [profiles, setProfiles] = useState<FileEntry[]>();
    const [profilesUpdating, setProfilesUpdating] = useState(false);
    const [loggingInUser, setLoggingInUser] = useState("");
    const [password, setPassword] = useState("");
    const importProfileButton = <button onClick={() => importUserProfile()}>Import Profile</button>;
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    if (dialogRef) {
        if (loggingInUser === "") {
            dialogRef.current?.close();
        } else {
            dialogRef.current?.showModal();
        }
    }

    if (!profilesUpdating) {
        setProfilesUpdating(true);
        readDir(USER_PROFILE_DIR, USER_PROFILE_BASE_DIR).then(docs => setProfiles(docs.sort((a, b) => stringSort(a.name, b.name))));
    }

    if (!props.user) {
        return (
            <div className="column">
                <div className="outlineContainer">
                    <div>User Profiles - Log in</div>
                    <div className="column">
                        {profiles && profiles.length > 0 ?
                            profiles.map(profile => <button id={profile.name} onClick={() => setLoggingInUser(profile.name?.split(".")[0] || "")}>{profile.name}</button>)
                            : undefined}
                    </div>
                </div>
                <div className="row">
                    <button onClick={() => createNewUserProfile()}>New Profile</button>
                    {importProfileButton}
                </div>
                <dialog ref={dialogRef}>
                    <div className="column">
                        <div>{loggingInUser}</div>
                        <label>Password:
                            <input
                                type="text"
                                value={password}
                                onChange={e => setPassword(e.target.value)} />
                        </label>
                        <div className="row">
                            <button onClick={() => closePasswordPrompt()}>Cancel</button>
                            <button onClick={() => attemptLogIn(loggingInUser, password)}>Submit</button>
                        </div>
                    </div>
                </dialog>
            </div>
        )
    }

    return (
        <div className="column">
            <label>Name:
                <input
                    type="text" value={props.user.name || ""}
                    onChange={e => {
                        if (props.user) {
                            updateUserData({ ...props.user, name: e.target.value })
                        }
                    }} />
            </label>
            <label>Note:
                <input
                    type="text" value={props.user.note || ""}
                    onChange={e => {
                        if (props.user) {
                            updateUserData({ ...props.user, note: e.target.value })
                        }
                    }} />
            </label>
            <button onClick={() => exportUserProfile()}>Export Profile</button>
            <button onClick={() => logOut()}>Log Out</button>
            <button className="danger" onClick={() => deleteCurrentProfile()}>Delete Profile</button>
        </div >
    );

    function attemptLogIn(userName: string, password: string) {
        if (userName) {
            const userFilePath = GetUserProfilePath(userName);

            // TODO validate password/encrypt .up files

            GetUserFromPath(userFilePath, USER_PROFILE_BASE_DIR).then(async readUser => {
                if (readUser) {
                    // Force user name to match file name, this will fix any sync issues if they happened
                    readUser.user.name = userName;
                    props.updateUser(readUser.user);
                    closePasswordPrompt();
                } else {
                    message(`Unable to log in to ${userName}`);
                }
            })
        } else {
            message(`Unable to log in to ${userName}`);
        }
    }

    function closePasswordPrompt() {
        setLoggingInUser("");
        setPassword("");
    }
    function logOut() {
        // Refresh any profile names
        setProfilesUpdating(false);
        props.updateUser(undefined);
    }

    function updateUserData(user: User) {
        
        props.updateUser(user);
    }



    async function createNewUserProfile() {
        let signingKey = await GenerateSigningKey();
        let encryptKey = await GenerateEncryptionKey();
        updateUserData({ name: "New User", note: "", encryptionKeys: encryptKey, signingKeys: signingKey, contacts: [] });
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
            GetUserFromPath(path).then(async readUser => {
                if (readUser) {
                    updateUserData(readUser.user);
                } else {
                    dialog.message(`Failed to import user profile: ${path}`)
                }
            })
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
            SaveUser(props.user, path);
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