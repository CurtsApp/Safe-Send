import { renameFile } from "@tauri-apps/api/fs";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { ContactsEditor } from "./components/ContactsEditor";
import { DecryptEditor } from "./components/DecryptEditor";
import { NotificationCore, NotificationPill } from "./components/Notification";
import { PackagingEditor } from "./components/PackagingEditor";
import { SideBarView } from "./components/SideBarView";
import { UserEditor } from "./components/UserEditor";
import { Contact } from "./interfaces/Contact";
import { User } from "./interfaces/User";
import { GetUserProfilePath, SaveUser, USER_PROFILE_BASE_DIR, VerifyUserProfilesDirectoryExists } from "./utils/user_utils";
import { listen } from "@tauri-apps/api/event";
import { getExtensionFromPath } from "./utils/general_utils";
import { ImportContact } from "./utils/contact_utils";

function App() {
  const [userProfile, setUserProfile] = useState<User>();
  const userProfileRef = useRef<User | undefined>(userProfile);
  const [activeNotifications, setActiveNotifications] = useState<{ core: NotificationCore; id: string; }[]>([]);
  const activeNotificationsRef = useRef<{ core: NotificationCore; id: string; }[]>(activeNotifications);
  const [onScreenNotifications, setOnScreenNotifications] = useState<Set<string>>(new Set<string>());
  const onScreenNotificationsRef = useRef<Set<string>>(onScreenNotifications);

  // Selected files for encrypt and decrypt views
  const [inputFiles, setInputFiles] = useState<string[]>([]);

  // Sidebar navigation selection state, starts on User Profile view
  const [selTabIdx, setSelTabIdx] = useState(2);

  const updateContacts = (newContacts: Contact[]) => {
    if (userProfile !== undefined) {
      updateUser({ ...userProfile, contacts: newContacts });
    }
  };

  useEffect(() => {
    // Set up references so current state can be accessed inside timeout & drop closures
    activeNotificationsRef.current = activeNotifications;
    onScreenNotificationsRef.current = onScreenNotifications;
    userProfileRef.current = userProfile;
  }, [activeNotifications, onScreenNotifications, userProfile]);

  useEffect(() => {
    // Run only once
    const unlisten = listen('tauri://file-drop', event => {
      // Override global state to ensure it is up to date
      const userProfile = userProfileRef.current;

      const files = event.payload as string[];

      const encryptedFiles: string[] = [];
      const contactFiles: string[] = [];
      const userProfiles: string[] = [];
      const otherFiles: string[] = [];

      // Don't allow drag and drop until sign in
      if (userProfile === undefined) {
        sendNotification({
          msg: "Sign in required",
          type: "fail"
        });
        return;
      }

      // Sort dropped files by file type
      files.forEach(filePath => {
        const extension = getExtensionFromPath(filePath);

        if (extension === "ef") {
          encryptedFiles.push(filePath);
        } else if (extension === "ssc") {
          contactFiles.push(filePath);
        } else if (extension === "up") {
          userProfiles.push(filePath);
        } else {
          otherFiles.push(filePath);
        }
      });

      // Only process one file type at a time, if any are found ignore the rest
      if (encryptedFiles.length > 0) {
        setInputFiles(encryptedFiles);
        setSelTabIdx(1);
      } else if (contactFiles.length > 0) {
        setSelTabIdx(3);
        ImportContact(contactFiles, userProfile?.contacts, updateContacts, sendNotification);
      } else if (userProfiles.length > 0) {
        // Importing user profile via drag and drop is not currently supported
        sendNotification({
          msg: "Sign out to import a user profile",
          type: "fail"
        })
      } else if (otherFiles.length > 0) {
        setInputFiles(otherFiles);
        setSelTabIdx(0);
      }
    });

    // Unmount listener when component unmounts
    return () => {
      unlisten.then(f => f());
    }
  }, []);



  const updateUser = (newUser: User | undefined) => {
    if (newUser === undefined) {
      setUserProfile(undefined);
      return;
    }
    VerifyUserProfilesDirectoryExists().then(() => {
      // Default to "old" username, if none then use provided name. This allows the creation of new user profiles.
      let userFileName = userProfile === undefined ? newUser.name : userProfile.name;
      // Save first using potentially old file name
      SaveUser(newUser, GetUserProfilePath(userFileName), USER_PROFILE_BASE_DIR).then(() => {
        if (userProfile && newUser.name !== userProfile.name) {
          // Rename stored file
          // TODO handle file name collision, don't DELETE ANYONES KEYS
          renameFile(GetUserProfilePath(userProfile.name), GetUserProfilePath(newUser.name), USER_PROFILE_BASE_DIR);
        }
      });

      setUserProfile({ ...newUser });
    });
  }

  const sendNotification = (newNotification: NotificationCore) => {
    // Override state, don't use it here it will be old from the timeout callback closure
    const activeNotifications = activeNotificationsRef.current;
    const wasActiveNotification = activeNotifications.length > 0;
    // ID is needed for key tracking a notifications animations
    const id = crypto.randomUUID()
    setActiveNotifications([...activeNotifications, { core: newNotification, id }]);

    const NOTIFICATION_DURATION = 5000;
    const NOTIFICATION_ANIMATION_DURATION = 200;
    const pruneNotification = () => {
      // Override state, don't use it here it will be old from the timeout callback closure
      const activeNotifications = activeNotificationsRef.current;
      const onScreenNotifications = onScreenNotificationsRef.current;
      if (activeNotifications.length > 0) {
        // Send notification off screen
        onScreenNotifications.delete(activeNotifications[0].id);
        setOnScreenNotifications(new Set([...onScreenNotifications]));

        setTimeout(() => {
          // delete notification after it has left the screen, this will shuffle all other notifications down too
          const activeNotifications = activeNotificationsRef.current;
          if (activeNotifications.length > 0) {
            // Pop first notification off
            activeNotifications.splice(0, 1);
            setActiveNotifications([...activeNotifications]);

            //Start timeout for next notification
            if (activeNotifications.length > 0) {
              setTimeout(pruneNotification, NOTIFICATION_DURATION);
            }
          }
        }, NOTIFICATION_ANIMATION_DURATION); // Should match css transition time to leave screen
      }
    }

    // Send notification onto the screen after 10ms
    setTimeout(() => {
      const newSet = new Set([...onScreenNotificationsRef.current, id]);
      setOnScreenNotifications(newSet);
    }, 10);

    // Active notification will start this timer once it finishes, don't duplicate 
    if (!wasActiveNotification) {
      // Timeout to remove notification
      setTimeout(pruneNotification, NOTIFICATION_DURATION);
    }
  }


  const manageProfileView = <UserEditor user={userProfile} updateUser={updateUser} sendNotification={sendNotification}></UserEditor>;
  const packageFileView = <PackagingEditor user={userProfile} sendNotification={sendNotification} inputFiles={inputFiles} setInputFiles={setInputFiles}></PackagingEditor>
  const decryptFileView = <DecryptEditor user={userProfile} sendNotification={sendNotification} inputFiles={inputFiles} setInputFiles={setInputFiles}></DecryptEditor>
  const contactsView = <ContactsEditor user={userProfile} sendNotification={sendNotification} updateContacts={updateContacts}></ContactsEditor>

  let userName = userProfile ? userProfile.name : "Sign in"
  const contextIcon = <div className="interactiveText" style={{ width: "100%", justifyContent: "center" }}>{userName}</div>

  return (
    <div>
      <SideBarView
        tabs={["Encrypt", "Decrypt", "My Profile", "Contacts"]}
        tabViews={[
          packageFileView,
          decryptFileView,
          manageProfileView,
          contactsView
        ]}
        contextIcon={contextIcon}
        pressIconSetsTabToIdx={2}
        selTabIdx={selTabIdx}
        lockToTab={userProfile === undefined}
        setSelTabIdx={setSelTabIdx}
      />
      <div style={{ position: "absolute" }}>
        {activeNotifications.map((notification, idx) => {
          return (
            <NotificationPill
              position={idx}
              core={notification.core}
              key={notification.id}
              isOnScreen={onScreenNotifications.has(notification.id)}
            ></NotificationPill>
          );
        })}
      </div>
    </div>

  );
}

export default App;
