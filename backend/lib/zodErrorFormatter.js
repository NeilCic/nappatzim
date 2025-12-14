export function formatZodError(zodError) {
  if (!zodError || !zodError.errors || zodError.errors.length === 0) {
    return "Validation failed. Please check your input.";
  }

  if (zodError.errors.length === 1) {
    return zodError.errors[0].message;
  }

  const errorMessages = zodError.errors.map(err => err.message);
  
  // Join with a separator, but limit to first 3 errors to avoid overwhelming the user
  const maxErrors = 3;
  const messagesToShow = errorMessages.slice(0, maxErrors);
  const combined = messagesToShow.join(". ");
  
  if (errorMessages.length > maxErrors) {
    return `${combined}. (and ${errorMessages.length - maxErrors} more error${errorMessages.length - maxErrors > 1 ? 's' : ''})`;
  }
  
  return combined;
}


export function formatZodErrorStructured(zodError) {
  if (!zodError || !zodError.errors || zodError.errors.length === 0) {
    return { error: "Validation failed. Please check your input." };
  }

  // If there's only one error, return simple format
  if (zodError.errors.length === 1) {
    const firstError = zodError.errors[0];
    const field = firstError.path.join('.');
    
    return {
      error: firstError.message,
      ...(field && { fields: { [field]: firstError.message } })
    };
  }

  // Multiple errors - create field-level mapping
  const fields = {};
  const errorMessages = [];
  
  zodError.errors.forEach(err => {
    const field = err.path.join('.');
    const message = err.message;
    
    if (field) {
      // If multiple errors for same field, keep the first one
      if (!fields[field]) {
        fields[field] = message;
      }
    }
    
    errorMessages.push(message);
  });

  // Create a summary message
  const summary = errorMessages.slice(0, 2).join(". ");
  const remaining = errorMessages.length - 2;
  const error = remaining > 0 
    ? `${summary} (and ${remaining} more error${remaining > 1 ? 's' : ''})`
    : summary;

  return {
    error,
    fields: Object.keys(fields).length > 0 ? fields : undefined
  };
}

