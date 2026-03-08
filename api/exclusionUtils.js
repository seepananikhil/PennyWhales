// Utility for checking if a stock should be excluded from scanning

const THERAPEUTICS_KEYWORDS = [
  'therapeutic',
  'therapeutics'
];

const LOAN_KEYWORDS = [
  'loan',
  'lending',
  'mortgage lender',
  'mortgage bank',
  'consumer lending',
  'specialty finance'
];

/**
 * Check if a stock should be excluded based on industry, company name, or description
 * @param {Object} stock - Stock object with industry, company_name, and description fields
 * @returns {boolean} - True if stock should be excluded, false otherwise
 */
function shouldExcludeStock(stock) {
  const industry = (stock.industry || '').toLowerCase();
  const companyName = (stock.company_name || '').toLowerCase();
  const description = (stock.description || '').toLowerCase();

  const isExcluded = THERAPEUTICS_KEYWORDS.some(k =>
    industry.includes(k) || companyName.includes(k) || description.includes(k)
  ) || LOAN_KEYWORDS.some(k =>
    industry.includes(k) || companyName.includes(k) || description.includes(k)
  );

  return false;
}

module.exports = {
  shouldExcludeStock,
  THERAPEUTICS_KEYWORDS,
  LOAN_KEYWORDS
};
