/**
 * Fuzzy search utility for finding items by name
 * Handles special characters, typos, and partial matches
 */

/**
 * Normalize text for fuzzy matching
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Fuzzy search for items
 * Returns items sorted by relevance
 */
export function fuzzySearchItems(
  query: string,
  items: Array<{ name: string; id?: string; marketHashName?: string; [key: string]: any }>,
  threshold: number = 0.6
): Array<{ item: any; score: number }> {
  if (!query || !items.length) return [];
  
  const normalizedQuery = normalizeForSearch(query);
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);
  
  const results: Array<{ item: any; score: number }> = [];
  
  for (const item of items) {
    const itemName = item.name || item.marketHashName || item.id || '';
    const normalizedItemName = normalizeForSearch(itemName);
    
    // Exact match gets highest score
    if (normalizedItemName === normalizedQuery) {
      results.push({ item, score: 1.0 });
      continue;
    }
    
    // Check if all query words are in item name
    const allWordsMatch = queryWords.every(word => normalizedItemName.includes(word));
    if (allWordsMatch) {
      const similarity = calculateSimilarity(normalizedQuery, normalizedItemName);
      results.push({ item, score: 0.8 + (similarity * 0.2) }); // Boost score for word match
      continue;
    }
    
    // Check if most words match (at least 70%)
    const matchingWords = queryWords.filter(word => normalizedItemName.includes(word));
    if (matchingWords.length >= Math.ceil(queryWords.length * 0.7)) {
      const similarity = calculateSimilarity(normalizedQuery, normalizedItemName);
      results.push({ item, score: 0.6 + (similarity * 0.2) });
      continue;
    }
    
    // Fuzzy similarity match
    const similarity = calculateSimilarity(normalizedQuery, normalizedItemName);
    if (similarity >= threshold) {
      results.push({ item, score: similarity });
    }
  }
  
  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Find best matching item from query
 */
export function findBestMatch(
  query: string,
  items: Array<{ name: string; id?: string; marketHashName?: string; [key: string]: any }>,
  threshold: number = 0.6
): any | null {
  const results = fuzzySearchItems(query, items, threshold);
  return results.length > 0 ? results[0].item : null;
}

