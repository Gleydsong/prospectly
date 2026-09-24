export class SdrDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidProspectTransitionError extends SdrDomainError {
  constructor(from: string, to: string) {
    super(`Prospect cannot move from ${from} to ${to}`);
  }
}

export class InvalidSdrCampaignError extends SdrDomainError {
  constructor(message: string) {
    super(message);
  }
}
