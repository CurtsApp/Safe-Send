interface LabeledOutlineContainerProps {
    label: string;
    children: string | JSX.Element | JSX.Element[] | undefined;
    fitContentWidth?: boolean;
}

export function LabeledOutlineContainer(props: LabeledOutlineContainerProps) {
    let fitWidth = props.fitContentWidth === undefined || props.fitContentWidth;
    return(
        <div className={`outlineContainer ${fitWidth ? "maxContentWidth" : null }`} style={{position: "relative", marginTop: 16}}>
            <div className="label">{props.label}</div>
            <div className="content">
                {props.children}
            </div>
        </div>
    )
}