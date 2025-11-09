import { LabelHTMLAttributes } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export default function Label({
    children,
    required = false,
    className = '',
    ...props
}: LabelProps) {
    return (
        <label
            className={`block text-sm font-medium text-gray-700 ${className}`}
            {...props}
        >
            {children}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );
}
