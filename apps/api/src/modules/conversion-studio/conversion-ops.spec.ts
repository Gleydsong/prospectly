import { BadRequestException } from '@nestjs/common';

import { ConversionAssetService } from './conversion-asset.service';
import { DomainBindingService } from './domain-binding.service';

describe('ConversionAssetService', () => {
  it('rejects non-HTTPS asset URLs before network calls', async () => {
    const prisma = {
      conversionPage: { findFirst: jest.fn().mockResolvedValue({ id: 'page-1' }) },
      conversionPageAsset: { create: jest.fn() },
    };
    const service = new ConversionAssetService(prisma as never);
    await expect(
      service.register('org-a', 'page-1', { url: 'http://example.com/a.png', altText: 'a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conversionPageAsset.create).not.toHaveBeenCalled();
  });

  it('rejects private / metadata hosts (SSRF)', async () => {
    const prisma = {
      conversionPage: { findFirst: jest.fn().mockResolvedValue({ id: 'page-1' }) },
      conversionPageAsset: { create: jest.fn() },
    };
    const service = new ConversionAssetService(prisma as never);
    await expect(
      service.register('org-a', 'page-1', { url: 'https://169.254.169.254/latest/meta-data/' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.register('org-a', 'page-1', { url: 'https://127.0.0.1/secret.png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conversionPageAsset.create).not.toHaveBeenCalled();
  });
});

describe('DomainBindingService', () => {
  it('rejects invalid hostnames', async () => {
    const entitlements = { assertFeature: jest.fn() };
    const prisma = { domainBinding: { create: jest.fn() }, conversionPage: { findFirst: jest.fn() } };
    const service = new DomainBindingService(prisma as never, entitlements as never);

    await expect(service.create('org-a', 'https://bad.example')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(entitlements.assertFeature).toHaveBeenCalledWith('org-a', 'custom_domain');
    expect(prisma.domainBinding.create).not.toHaveBeenCalled();
  });
});
