export const capitalizeFirst = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.split(' ').map(word => capitalizeFirst(word)).join(' ');
};

export const truncateText = (str, maxLength = 50) => {
  if (!str || typeof str !== 'string') return '';
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
};

export const formatName = (firstName, lastName) => {
  return `${capitalizeFirst(firstName || '')} ${capitalizeFirst(lastName || '')}`.trim();
};

export const formatDate = (dateString) => {
  if (!dateString) return 'No date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-UK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
};