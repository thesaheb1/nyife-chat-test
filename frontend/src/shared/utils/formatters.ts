/**
 * Format amount in paise to currency display string
 */
export function formatCurrency(amountInPaise: number, currency: string = 'INR'): string {
  const amount = amountInPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format ISO date string to human-readable format
 */
export function formatDate(isoString: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(isoString));
}

/**
 * Format E.164 phone number for display
 */
export function formatPhone(phone: string): string {
  if (!phone) return '-';
  // Simple formatting: +91 XXXXX XXXXX
  if (phone.startsWith('+91') && phone.length === 13) {
    return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

/**
 * Trigger file download from a URL
 */
export function downloadFile(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
