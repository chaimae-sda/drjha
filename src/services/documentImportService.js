import { apiClient } from './apiService';
import { ocrService } from './ocrService';

const saveProcessedDocument = async (result, source, file = null) => {
  if (!result) {
    return null;
  }

  const saveResponse = await apiClient.saveText(
    result.title,
    result.originalText,
    result.darijaText,
    'fr',
    source,
    file?.name || (source === 'scan' ? 'camera-capture.jpg' : ''),
    file?.type || (source === 'scan' ? 'image/jpeg' : ''),
  );

  if (saveResponse?.error) {
    throw new Error(saveResponse.error);
  }

  return saveResponse?.text || null;
};

export const importDocument = async (file) => {
  if (!file) {
    return null;
  }

  let result;

  if (file.type === 'application/pdf') {
    result = await ocrService.scanPDF(file);
  } else {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    result = await ocrService.scanImage(base64, file.type);
  }

  return saveProcessedDocument(result, 'upload', file);
};

export const importCapturedImage = async (base64Image, mimeType = 'image/jpeg') => {
  const result = await ocrService.scanImage(base64Image, mimeType);
  return saveProcessedDocument(result, 'scan');
};
