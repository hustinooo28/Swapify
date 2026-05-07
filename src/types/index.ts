export type User = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  location?: string;
  address?: string;
  phone?: string;
  biometric_enabled?: boolean;
  created_at: string;
};

export type Item = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  estimated_value: number;
  image_url: string;
  category: string;
  condition: 'Brand New' | 'Like New' | 'Good' | 'Fair' | 'Poor';
  status: 'available' | 'pending' | 'traded';
  created_at: string;
  user?: User;
};

export type Offer = {
  id: string;
  sender_id: string;
  receiver_id: string;
  offered_item_id: string;
  requested_item_id: string;
  cash_addition: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  offered_item?: Item;
  requested_item?: Item;
  sender?: User;
  receiver?: User;
};

export type Message = {
  id: string;
  offer_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: User;
};