/**
 * DRep ID Conversion Utilities
 * 
 * Handles conversion between CIP-105 (Legacy) and CIP-129 (New) DRep ID formats.
 * 
 * CIP-105 (Legacy):
 * - Raw credential hex is encoded directly
 * - Hex length: 56 characters
 * - Bech32 prefixes: "drep" (key-based) or "drep_script" (script-based)
 * 
 * CIP-129 (New):
 * - Two-byte header (22 for key-based, 23 for script-based) + raw credential hex
 * - Hex length: 58 characters
 * - Bech32 prefix: "drep" for both key-based and script-based
 * 
 * The backend handles format conversion automatically.
 * We use CIP-129 throughout the application for consistency.
 */

import { bech32 as bech32lib } from 'bech32';

/**
 * Check if a DRep ID is a special system DRep (not a valid Bech32 ID)
 */
export function isSpecialSystemDRep(drepId: string): boolean {
  // Special system DReps that are not valid Bech32 IDs
  const specialDReps = [
    'drep_always_abstain',
    'drep_always_no_confidence',
    'drep_always_yes',
    'drep_always_no',
  ];
  return specialDReps.includes(drepId);
}

/**
 * Check if a DRep ID is valid
 */
export function isValidDRepID(bechID: string): boolean {
  // Special system DReps are valid DRep IDs but not Bech32 format
  if (isSpecialSystemDRep(bechID)) {
    return true;
  }
  
  // DRep ID regex pattern
  // they start with drep1 (at length of 56 or 58) or drep_script1 (at length of 63)
  const drepIDPattern = /^(drep1[a-zA-Z0-9]{51,53}|drep_script1[a-zA-Z0-9]{51})$/;
  return drepIDPattern.test(bechID);
}

/**
 * Decode DRep ID from Bech32 to hex
 */
export function decodeDRepIDToHex(bechID: string): string {
  try {
    const decoded = bech32lib.decode(bechID);
    const bytes = bech32lib.fromWords(decoded.words);
    const hex = Buffer.from(bytes).toString('hex');
    return hex;
  } catch {
    throw new Error(`Invalid DRep ID format: ${bechID}`);
  }
}

/**
 * Determine if a hex-encoded DRep ID is CIP-105 or CIP-129
 * @param hexID Hex-encoded DRep ID
 * @returns true if CIP-105, false if CIP-129
 */
export function isHexIDCIP105(hexID: string): boolean {
  // Use the length of the hex ID to determine if CIP-105 or CIP-129
  // if length is 56 then CIP-105, if 58 then CIP-129
  if (hexID.length === 56) {
    return true;
  } else if (hexID.length === 58) {
    return false;
  }
  throw new Error(`Invalid hex encoded DRep ID length: ${hexID.length}. Must be 56 (CIP-105) or 58 (CIP-129) characters.`);
}

/**
 * Check if a DRep ID is script-based
 */
export function isBechIDScriptBased(bech32ID: string, isCIP105: boolean): boolean {
  const hexEncodedID = decodeDRepIDToHex(bech32ID);
  
  if (bech32ID.startsWith("drep_script1")) {
    return true;
  } else if (!isCIP105 && hexEncodedID.startsWith("23")) {
    // CIP-129 script-based has prefix 23
    return true;
  } else {
    // CIP-105 key-based OR CIP-129 key-based (prefix 22)
    return false;
  }
}

/**
 * Encode hex DRep ID to Bech32
 */
export function hexToBech32(hexID: string, isScript?: boolean, useCIP129: boolean = true): string {
  const isCIP105 = !useCIP129 && isHexIDCIP105(hexID);
  const bytes = Buffer.from(hexID, 'hex');
  const words = bech32lib.toWords(bytes);
  
  // If we are encoding a CIP105 hex ID
  if (isCIP105) {
    if (isScript) {
      return bech32lib.encode("drep_script", words);
    } else {
      return bech32lib.encode("drep", words);
    }
  } else {
    // CIP-129: Always use "drep" prefix
    return bech32lib.encode("drep", words);
  }
}

/**
 * Convert CIP-105 DRep ID to CIP-129
 */
export function convertCIP105ToCIP129(cip105ID: string): string {
  const hexEncodedID = decodeDRepIDToHex(cip105ID);
  const isCIP105 = isHexIDCIP105(hexEncodedID);
  
  if (!isCIP105) {
    // Already CIP-129, return as-is
    return cip105ID;
  }
  
  // Determine if script-based
  const isScriptBased = isBechIDScriptBased(cip105ID, true);
  
  // Add CIP-129 prefix: 23 for script-based, 22 for key-based
  const cip129Hex = (isScriptBased ? '23' : '22') + hexEncodedID;
  
  return hexToBech32(cip129Hex, false, true);
}

/**
 * Convert CIP-129 DRep ID to CIP-105
 */
export function convertCIP129ToCIP105(cip129ID: string): string {
  const hexEncodedID = decodeDRepIDToHex(cip129ID);
  const isCIP105 = isHexIDCIP105(hexEncodedID);
  
  if (isCIP105) {
    // Already CIP-105, return as-is
    return cip129ID;
  }
  
  // Remove the two-byte prefix (22 or 23)
  const cip105Hex = hexEncodedID.slice(2);
  
  // Determine if script-based from the prefix
  const isScriptBased = hexEncodedID.startsWith("23");
  
  return hexToBech32(cip105Hex, isScriptBased, false);
}

/**
 * Normalize DRep ID to CIP-129 format (used throughout the application)
 */
export function normalizeToCIP129(drepID: string): string {
  // Special system DReps cannot be converted to CIP-129 (they're not Bech32)
  if (isSpecialSystemDRep(drepID)) {
    return drepID; // Return as-is for special system DReps
  }
  
  if (!isValidDRepID(drepID)) {
    throw new Error(`Invalid DRep ID: ${drepID}`);
  }
  
  const hexEncodedID = decodeDRepIDToHex(drepID);
  const isCIP105 = isHexIDCIP105(hexEncodedID);
  
  if (isCIP105) {
    return convertCIP105ToCIP129(drepID);
  }
  
  // Already CIP-129
  return drepID;
}

/**
 * Convert DRep ID to CIP-105 format (legacy format)
 */
export function convertToCIP105(drepID: string): string {
  if (!isValidDRepID(drepID)) {
    throw new Error(`Invalid DRep ID: ${drepID}`);
  }
  
  const hexEncodedID = decodeDRepIDToHex(drepID);
  const isCIP105 = isHexIDCIP105(hexEncodedID);
  
  if (isCIP105) {
    return drepID;
  }
  
  return convertCIP129ToCIP105(drepID);
}

/**
 * Convert DRep ID to CIP-129 format (new standard format)
 */
export function convertToCIP129(drepID: string): string {
  if (!isValidDRepID(drepID)) {
    throw new Error(`Invalid DRep ID: ${drepID}`);
  }
  
  const hexEncodedID = decodeDRepIDToHex(drepID);
  const isCIP105 = isHexIDCIP105(hexEncodedID);
  
  if (!isCIP105) {
    return drepID;
  }
  
  return convertCIP105ToCIP129(drepID);
}

