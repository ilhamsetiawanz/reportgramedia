/**
 * Formats a number or string into Indonesian Currency format (Rp 1.000.000)
 */
export const formatCurrency = (value: string | number): string => {
  if (!value && value !== 0) return "";
  
  const numberString = value.toString().replace(/[^0-9]/g, "");
  if (!numberString) return "";
  
  const numberValue = parseInt(numberString);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numberValue).replace(/,/g, ".");
};

/**
 * Parses a currency string back into a numeric value
 */
export const parseCurrency = (value: string): number => {
  return parseInt(value.replace(/[^0-9]/g, "")) || 0;
};
