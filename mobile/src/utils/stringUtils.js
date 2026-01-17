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

export const formatDateDetailed = (dateString) => {  // todo think about unifying this with formatDate
  if (!dateString) return 'No date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'Invalid date';
  }
};

export const formatDateRelative = (dateString, options = {}) => {
  const { showDaysAgo = false, locale = 'en-US', useDefaultLocale = false } = options;
  
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Use toDateString() for accurate day comparison (handles timezone better than diffDays)
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (showDaysAgo) {
      const diffMs = today - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        // For dates > 7 days, use formatted date with specified locale
        return date.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } else {
      // For ConversationScreen-style: no "X days ago", just formatted date
      if (useDefaultLocale) {
        return date.toLocaleDateString();
      } else {
        return date.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
  } catch (error) {
    return 'Invalid date';
  }
};