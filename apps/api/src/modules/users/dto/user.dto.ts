// Yanit tipleri — api-contract.yaml → User, Subscription, MeResponse ile birebir.

export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface SubscriptionDto {
  status: 'inactive' | 'pending' | 'active';
  priceAmount: string | null;
  currency: string;
  currentPeriodEnd: string | null;
}

export interface MeDto extends UserDto {
  subscription: SubscriptionDto;
}
