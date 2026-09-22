// services/idGeneratorService.js
const { db } = require('../config/firebaseAdmin');

/**
 * Maps full domain names to 2-letter uppercase codes.
 * Customize or expand this mapping as needed.
 */
const getDomainCode = (domain) => {
  const mapping = {
    software: 'SD',
    mechanical: 'MD',
    electronics: 'ED',
    aero: 'AD',
    
  };
  return mapping[domain?.toLowerCase()?.trim()] || 'XX';
};

/**
 * Extracts 2-digit year (e.g., "2027" or 2027 -> "27")
 */
const getYearCode = (yearOfPassing) => {
  const strYear = String(yearOfPassing).trim();
  return strYear.length >= 2 ? strYear.slice(-2) : '00';
};

/**
 * Generates Temporary RTF ID before approval (e.g., SD27-T01@RTF)
 * Uses atomic transactions under /counters/tempRtfIds/{DOMAIN_YEAR}
 * 
 * @param {string} domain - Domain name (e.g., "software")
 * @param {string|number} yearOfPassing - Year of passing (e.g., 2027)
 * @returns {Promise<string>} Generated temp RTF ID
 */
const generateTempRtfId = async (domain, yearOfPassing) => {
  const domainCode = getDomainCode(domain);
  const yearCode = getYearCode(yearOfPassing);
  const counterKey = `${domainCode}_${yearCode}`;

  const counterRef = db.ref(`counters/tempRtfIds/${counterKey}`);
  
  // Atomic transaction ensures safe concurrent increments
  const result = await counterRef.transaction((currentValue) => {
    return (currentValue || 0) + 1;
  });

  if (!result.committed) {
    throw new Error('Failed to generate temporary RTF ID sequence.');
  }

  // Pad counter to 2 digits (01, 02, 03... 10)
  const seqNumber = String(result.snapshot.val()).padStart(2, '0');
  
  return `${domainCode}${yearCode}-T${seqNumber}@RTF`;
};

/**
 * Generates Official RTF ID after approval (e.g., SD2701@RTF)
 * Uses atomic transactions under /counters/officialRtfIds/{DOMAIN_YEAR}
 * 
 * @param {string} domain - Domain name (e.g., "software")
 * @param {string|number} yearOfPassing - Year of passing (e.g., 2027)
 * @returns {Promise<string>} Generated official RTF ID
 */
const generateOfficialRtfId = async (domain, yearOfPassing) => {
  const domainCode = getDomainCode(domain);
  const yearCode = getYearCode(yearOfPassing);
  const counterKey = `${domainCode}_${yearCode}`;

  const counterRef = db.ref(`counters/officialRtfIds/${counterKey}`);

  // Atomic transaction for official ID
  const result = await counterRef.transaction((currentValue) => {
    return (currentValue || 0) + 1;
  });

  if (!result.committed) {
    throw new Error('Failed to generate official RTF ID sequence.');
  }

  // Pad counter to 2 digits (01, 02, 03... 10)
  const seqNumber = String(result.snapshot.val()).padStart(2, '0');

  return `${domainCode}${yearCode}${seqNumber}@RTF`;
};

module.exports = {
  getDomainCode,
  getYearCode,
  generateTempRtfId,
  generateOfficialRtfId,
};