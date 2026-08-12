// Global JwtAuthGuard varsayilan olarak KAPALIDIR; bu dekorator ile isaretli route'lar
// kimlik dogrulamasi olmadan erisilebilir (CLAUDE.md §1, api-contract.yaml security).

import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublicRoute';

export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
