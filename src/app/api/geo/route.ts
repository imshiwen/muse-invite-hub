import { apiJson, errorResponse } from '@/lib/api-errors';
import { getTrustedCountry } from '@/lib/security';

const consentRequiredCountries = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'LI', 'GB', 'CH',
]);

export async function GET() {
  try {
    const country = await getTrustedCountry();
    return apiJson({ country, region: country, requireConsent: !country || consentRequiredCountries.has(country) });
  } catch (error) {
    return errorResponse(error);
  }
}
