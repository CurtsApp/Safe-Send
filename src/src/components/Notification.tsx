export interface NotificationCore {
    type: "success" | "fail";
    msg: string;
}

interface NotificationProps {
    core: NotificationCore;
    position: number;
    isOnScreen: boolean;
}

export function NotificationPill(props: NotificationProps) {
    let bottomOffset = props.position * 75 + 25;

    return (
        <div className={`notificationPill ${props.core.type === "success" ? "success" : "fail"} ${props.isOnScreen ? "onScreen" : null}`} style={{position: "fixed", bottom: bottomOffset, right: 0}}>
            {props.core.msg}
        </div>
    )
}