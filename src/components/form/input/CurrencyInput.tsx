import React, { FC } from "react";
import InputField from "./InputField";
import { formatCurrency, parseCurrency } from "../../../utils/currencyFormatter";

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  hint?: string;
  required?: boolean;
  className?: string;
}

const CurrencyInput: FC<CurrencyInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  hint,
  required,
  className
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parseCurrency(rawValue);
    onChange(numericValue);
  };

  const displayValue = value === 0 ? "" : formatCurrency(value);

  return (
    <InputField
      label={label}
      type="text" // Change to text for formatted display
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || "Rp 0"}
      disabled={disabled}
      error={error}
      hint={hint}
      required={required}
      className={className}
    />
  );
};

export default CurrencyInput;
