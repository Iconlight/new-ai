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
  news_context?: {
    title: string;
    description?: string;
    url?: string;
    category?: string;
  };
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
  scheduled_for: string;
  is_sent: boolean;
  created_at: string;
  sent_at?: string;
  source_url?: string;
  source_title?: string;
  source_description?: string;
  source_type?: string;
  category?: string;
}

export interface NetworkingMatch {
  id: string;
  userId1: string;
  userId2: string;
  compatibilityScore: number;
  sharedInterests: string[];
  matchReason: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  otherUser?: {
    id: string;
    name: string;
    avatar?: string;
    interests: string[];
    communicationStyle: string;
  };
}

export interface ConversationPattern {
  userId: string;
  communicationStyle: 'analytical' | 'creative' | 'empathetic' | 'direct' | 'philosophical';
  curiosityLevel: number;
  topicDepth: number;
  questionAsking: number;
  responseLength: 'concise' | 'moderate' | 'detailed';
  interests: string[];
  conversationTopics: string[];
  intellectualCuriosity: number;
  emotionalIntelligence: number;
  lastAnalyzed: Date;
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
