"use client";
import * as React from "react";
import { clx } from "../../utils/clx";
const sanitizeOtp = (value, length) => {
    return value.replace(/\D/g, "").slice(0, length);
};
const getDigits = (value, length) => {
    return sanitizeOtp(value, length).padEnd(length, " ").split("");
};
const getWritableDigits = (value, length) => {
    return getDigits(value, length).map((digit) => (digit === " " ? "" : digit));
};
const getDigitGroups = (length, groupSize) => {
    return Array.from({ length: Math.ceil(length / groupSize) }).map((_, groupIndex) => {
        const start = groupIndex * groupSize;
        return {
            start,
            length: Math.min(groupSize, length - start),
        };
    });
};
const applyOtpAtIndex = (digits, index, value, length) => {
    value.split("").forEach((digit, offset) => {
        if (index + offset < length) {
            digits[index + offset] = digit;
        }
    });
    return digits;
};
/**
 * A controlled segmented input for one-time passwords, PINs, and short numeric verification codes.
 */
const OtpInput = React.forwardRef(({ "aria-invalid": ariaInvalid, "aria-label": ariaLabel = "One-time password", autoFocus, className, disabled, groupSize = 3, inputClassName, length = 6, onChange, onComplete, readOnly, separator = "-", value, ...props }, ref) => {
    const inputRefs = React.useRef([]);
    const codeLength = Math.max(1, length);
    const digits = getDigits(value, codeLength);
    const safeGroupSize = Math.max(1, groupSize);
    const digitGroups = getDigitGroups(codeLength, safeGroupSize);
    const focusInput = (index) => {
        var _a;
        const nextIndex = Math.min(Math.max(index, 0), codeLength - 1);
        (_a = inputRefs.current[nextIndex]) === null || _a === void 0 ? void 0 : _a.focus();
    };
    const updateValue = (nextValue, nextFocusIndex) => {
        const sanitizedValue = sanitizeOtp(nextValue, codeLength);
        onChange(sanitizedValue);
        if (sanitizedValue.length === codeLength) {
            onComplete === null || onComplete === void 0 ? void 0 : onComplete(sanitizedValue);
        }
        if (typeof nextFocusIndex === "number") {
            requestAnimationFrame(() => focusInput(nextFocusIndex));
        }
    };
    const handleChange = (index, rawValue) => {
        const nextDigits = getWritableDigits(value, codeLength);
        const incoming = sanitizeOtp(rawValue, codeLength);
        if (!incoming) {
            nextDigits[index] = "";
            updateValue(nextDigits.join(""), index);
            return;
        }
        applyOtpAtIndex(nextDigits, index, incoming, codeLength);
        updateValue(nextDigits.join(""), Math.min(index + incoming.length, codeLength - 1));
    };
    const handleKeyDown = (event, index) => {
        if (event.key === "Backspace" && !digits[index].trim()) {
            event.preventDefault();
            if (index === 0) {
                return;
            }
            const nextDigits = getWritableDigits(value, codeLength);
            nextDigits[index - 1] = "";
            updateValue(nextDigits.join(""), index - 1);
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusInput(index - 1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            focusInput(index + 1);
        }
        if (event.key === "Home") {
            event.preventDefault();
            focusInput(0);
        }
        if (event.key === "End") {
            event.preventDefault();
            focusInput(codeLength - 1);
        }
    };
    const handlePaste = (event, index) => {
        event.preventDefault();
        const pastedValue = sanitizeOtp(event.clipboardData.getData("text"), codeLength);
        if (!pastedValue) {
            return;
        }
        if (pastedValue.length === codeLength) {
            updateValue(pastedValue, codeLength - 1);
            return;
        }
        const nextDigits = getWritableDigits(value, codeLength);
        applyOtpAtIndex(nextDigits, index, pastedValue, codeLength);
        updateValue(nextDigits.join(""), Math.min(index + pastedValue.length, codeLength - 1));
    };
    const renderInput = (index) => {
        return (React.createElement("input", { key: index, ref: (element) => {
                inputRefs.current[index] = element;
            }, "aria-invalid": ariaInvalid, "aria-label": `${ariaLabel} ${index + 1}`, autoComplete: index === 0 ? "one-time-code" : "off", autoFocus: autoFocus && index === 0, className: clx("txt-compact-large font-mono text-ui-fg-base bg-ui-bg-field hover:bg-ui-bg-field-hover shadow-borders-base transition-fg relative -ml-px flex size-10 appearance-none items-center justify-center border-0 text-center outline-none first:ml-0 first:rounded-l-md last:rounded-r-md", "focus-visible:z-10 focus-visible:shadow-borders-interactive-with-active", "disabled:text-ui-fg-disabled disabled:!bg-ui-bg-disabled disabled:cursor-not-allowed", "aria-[invalid=true]:!shadow-borders-error", inputClassName), disabled: disabled, inputMode: "numeric", maxLength: codeLength, onChange: (event) => handleChange(index, event.target.value), onFocus: (event) => event.target.select(), onKeyDown: (event) => handleKeyDown(event, index), onPaste: (event) => handlePaste(event, index), pattern: "[0-9]*", readOnly: readOnly, type: "text", value: digits[index].trim() }));
    };
    return (React.createElement("div", { ref: ref, "aria-invalid": ariaInvalid, "aria-label": ariaLabel, className: clx("flex items-center justify-center gap-x-3", className), role: "group", ...props }, digitGroups.map(({ start, length }, groupIndex) => {
        return (React.createElement(React.Fragment, { key: groupIndex },
            groupIndex > 0 && separator && (React.createElement("span", { "aria-hidden": "true", className: "txt-compact-small-plus text-ui-fg-muted" }, separator)),
            React.createElement("div", { className: "flex" }, Array.from({ length }).map((_, offset) => renderInput(start + offset)))));
    })));
});
OtpInput.displayName = "OtpInput";
export { OtpInput };
//# sourceMappingURL=otp-input.js.map