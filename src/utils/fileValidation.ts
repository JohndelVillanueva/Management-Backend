export const isFileTypeAllowed = (fileName: string, allowedFileTypes: string[]): boolean => {
  if (allowedFileTypes.includes('*')) return true;
  
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  const fileType = fileName.split('.').pop()?.toLowerCase();
  
  return allowedFileTypes.some(allowedType => {
    if (allowedType.includes(',')) {
      // Handle multiple extensions like ".doc,.docx"
      return allowedType.split(',').some(ext => ext.trim() === fileExtension);
    } else if (allowedType === 'image/*') {
      // Handle image wildcard
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      return imageExtensions.includes(fileExtension || '');
    } else {
      // Handle single extension or wildcard
      return allowedType === fileExtension;
    }
  });
};