import * as React from "react";
interface OtpInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
    /**
     * Whether the inputs should focus the first field on mount.
     */
    autoFocus?: boolean;
    /**
     * Whether the inputs are disabled.
     */
    disabled?: boolean;
    /**
     * How many digits to show before rendering a separator.
     */
    groupSize?: number;
    /**
     * Additional class name for each input.
     */
    inputClassName?: string;
    /**
     * The number of digits in the code.
     */
    length?: number;
    /**
     * Called with the sanitized code whenever it changes.
     */
    onChange: (value: string) => void;
    /**
     * Called when the sanitized code reaches the configured length.
     */
    onComplete?: (value: string) => void;
    /**
     * Whether the inputs are read-only.
     */
    readOnly?: boolean;
    /**
     * The separator rendered between groups.
     */
    separator?: React.ReactNode;
    /**
     * The controlled code value.
     */
    value: string;
}
/**
 * A controlled segmented input for one-time passwords, PINs, and short numeric verification codes.
 */
declare const OtpInput: React.ForwardRefExoticComponent<OtpInputProps & React.RefAttributes<HTMLDivElement>>;
export { OtpInput };
export type { OtpInputProps };
//# sourceMappingURL=otp-input.d.ts.map