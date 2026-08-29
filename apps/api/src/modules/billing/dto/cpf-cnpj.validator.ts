import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';

export function isValidCpfCnpj(value: string): boolean {
  if (value.length === 11) return isValidCpf(value);
  if (value.length === 14) return isValidCnpj(value);
  return false;
}

@ValidatorConstraint({ name: 'isCpfCnpj', async: false })
export class IsCpfCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpfCnpj(value);
  }

  defaultMessage(): string {
    return 'CPF ou CNPJ inválido';
  }
}

function isValidCpf(digits: string): boolean {
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const check = (length: number, weights: number[]) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    check(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12]) &&
    check(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13])
  );
}
