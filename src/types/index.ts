export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserInterest {
  id: string;
  user_id: string;
  interest: string;
  is_custom: boolean;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  notification_enabled: boolean;
  daily_conversation_count: number;
  preferred_notification_time: string;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
}

export interface ProactiveTopic {
  id: string;
  user_id: string;
  topic: string;
  message: string;
  interests: string[];
  is_sent: boolean;
  scheduled_for: string;
  sent_at?: string;
  created_at: string;
}

export interface GiftedChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

export const PREDEFINED_INTERESTS = [
  'Technology',
  'Science',
  'Health & Fitness',
  'Travel',
  'Food & Cooking',
  'Movies & TV',
  'Music',
  'Books & Literature',
  'Sports',
  'Art & Design',
  'Photography',
  'Gaming',
  'Fashion',
  'Business & Finance',
  'Politics',
  'Environment',
  'Education',
  'History',
  'Philosophy',
  'Psychology'
];
