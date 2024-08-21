interface LabeledOutlineContainerProps {
    label: string;
    children: string | JSX.Element | JSX.Element[] | undefined;
}

export function LabeledOutlineContainer(props: LabeledOutlineContainerProps) {

    return(
        <div className="outlineContainer" style={{position: "relative"}}>
            <div style={{position: "absolute", top: "-12px", left: "1em" }}>{props.label}</div>
            <div style={{display: "absolute" }}>
                {props.children}
            </div>
        </div>
    )
}