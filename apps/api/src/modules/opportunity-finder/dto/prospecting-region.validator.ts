import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';

import { isBrazilianStateCode } from '../../prospecting/domain/search-provider';

@ValidatorConstraint({ name: 'opportunityFinderBrazilianState', async: false })
export class ProspectingRegionForCountry implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isBrazilianStateCode(value.trim().toUpperCase());
  }

  defaultMessage(): string {
    return 'state must be a valid Brazilian UF';
  }
}
