import { useState } from "react";

interface LabeledInputFieldProps {
    label: string;
    fieldValue: string;
    updateStringValue: (updatedValue: string) => void;
    fieldType?: string;
}

export function LabeledInputField(props: LabeledInputFieldProps) {
    const [isFocused, setFocused] = useState(false);
    let fieldType = props.fieldType || "text";

    return (
        <div className={`labeledInputContainer ${isFocused || props.fieldValue ? "focus" : undefined}`}>
            <label className="input-label">{props.label}</label>
            <input
                className="input-1"
                type={fieldType}
                value={props.fieldValue}
                onChange={(e) => props.updateStringValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
        </div>
    )
}