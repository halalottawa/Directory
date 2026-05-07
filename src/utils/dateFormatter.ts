/**
 * Formats a date string into a "letters and numbers" format (e.g., "March 19, 2026").
 * @param dateString The ISO date string to format.
 * @returns A formatted date string.
 */
export const formatDate = (dateString: string | Date): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Formats a date string into a time string with AM/PM.
 * @param dateString The ISO date string to format.
 * @returns A formatted time string (e.g., "2:30 PM").
 */
export const formatTime = (dateString: string | Date): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Time';
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${minutesStr} ${ampm}`;
};
