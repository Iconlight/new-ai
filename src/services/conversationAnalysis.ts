import { supabase } from './supabase';

export interface ConversationPattern {
  userId: string;
  communicationStyle: 'analytical' | 'creative' | 'empathetic' | 'direct' | 'philosophical';
  curiosityLevel: number; // 0-100
  topicDepth: number; // How deep they go into topics
  questionAsking: number; // How often they ask questions
  responseLength: 'concise' | 'moderate' | 'detailed';
  interests: string[];
  conversationTopics: string[];
  intellectualCuriosity: number;
  emotionalIntelligence: number;
  lastAnalyzed: Date;
}

export interface UserCompatibility {
  userId1: string;
  userId2: string;
  compatibilityScore: number; // 0-100
  sharedInterests: string[];
  complementaryTraits: string[];
  conversationPotential: number;
  matchReason: string;
  createdAt: Date;
}

/**
 * Analyzes a user's conversation patterns using AI
 */
export const analyzeConversationPattern = async (userId: string): Promise<ConversationPattern | null> => {
  try {
    // Get user's recent conversations (last 30 days)
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        content,
        role,
        created_at,
        chats!inner(user_id)
      `)
      .eq('chats.user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('role', 'user') // Only analyze user messages, not AI responses
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !messages || messages.length === 0) {
      console.error('Error fetching messages for analysis:', error);
      return null;
    }

    // Prepare conversation text for AI analysis
    const conversationText = messages
      .map(msg => msg.content)
      .join('\n---\n');

    // Use AI to analyze conversation patterns
    const analysisPrompt = `Analyze this user's conversation patterns and extract their communication style, interests, and personality traits. 

Conversation samples:
${conversationText}

Return a JSON object with this exact structure:
{
  "communicationStyle": "analytical|creative|empathetic|direct|philosophical",
  "curiosityLevel": 0-100,
  "topicDepth": 0-100,
  "questionAsking": 0-100,
  "responseLength": "concise|moderate|detailed",
  "interests": ["interest1", "interest2", ...],
  "conversationTopics": ["topic1", "topic2", ...],
  "intellectualCuriosity": 0-100,
  "emotionalIntelligence": 0-100
}

Base your analysis on:
- Communication style: How they express ideas
- Curiosity level: How much they explore new topics
- Topic depth: How deeply they engage with subjects
- Question asking: How often they ask questions to learn more
- Response length: Typical length of their messages
- Interests: Topics they're passionate about
- Intellectual curiosity: Desire to learn and understand
- Emotional intelligence: Empathy and social awareness in conversations`;

    // This would use your AI service - for now, return a mock pattern
    // const aiResponse = await generateAIResponse([{ role: 'user', content: analysisPrompt }]);
    
    // Mock analysis for development
    const mockPattern: ConversationPattern = {
      userId,
      communicationStyle: 'analytical',
      curiosityLevel: 85,
      topicDepth: 78,
      questionAsking: 65,
      responseLength: 'moderate',
      interests: ['technology', 'philosophy', 'science'],
      conversationTopics: ['AI development', 'future of work', 'consciousness'],
      intellectualCuriosity: 90,
      emotionalIntelligence: 72,
      lastAnalyzed: new Date()
    };

    // Store the analysis in the database
    await supabase
      .from('user_conversation_patterns')
      .upsert({
        user_id: userId,
        communication_style: mockPattern.communicationStyle,
        curiosity_level: mockPattern.curiosityLevel,
        topic_depth: mockPattern.topicDepth,
        question_asking: mockPattern.questionAsking,
        response_length: mockPattern.responseLength,
        interests: mockPattern.interests,
        conversation_topics: mockPattern.conversationTopics,
        intellectual_curiosity: mockPattern.intellectualCuriosity,
        emotional_intelligence: mockPattern.emotionalIntelligence,
        last_analyzed: mockPattern.lastAnalyzed.toISOString()
      }, {
        onConflict: 'user_id'
      });

    return mockPattern;
  } catch (error) {
    console.error('Error analyzing conversation pattern:', error);
    return null;
  }
};

/**
 * Finds compatible users based on conversation patterns
 */
export const findCompatibleUsers = async (userId: string): Promise<UserCompatibility[]> => {
  try {
    // Get current user's pattern
    const userPattern = await getUserConversationPattern(userId);
    if (!userPattern) return [];

    // Get all other users' patterns
    const { data: otherPatterns, error } = await supabase
      .from('user_conversation_patterns')
      .select('*')
      .neq('user_id', userId);

    if (error || !otherPatterns) return [];

    const compatibilities: UserCompatibility[] = [];

    for (const otherPattern of otherPatterns) {
      const compatibility = calculateCompatibility(userPattern, otherPattern);
      if (compatibility.compatibilityScore > 60) { // Only include good matches
        compatibilities.push(compatibility);
      }
    }

    // Sort by compatibility score
    return compatibilities.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  } catch (error) {
    console.error('Error finding compatible users:', error);
    return [];
  }
};

/**
 * Gets a user's conversation pattern from the database
 */
export const getUserConversationPattern = async (userId: string): Promise<ConversationPattern | null> => {
  try {
    const { data, error } = await supabase
      .from('user_conversation_patterns')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      communicationStyle: data.communication_style,
      curiosityLevel: data.curiosity_level,
      topicDepth: data.topic_depth,
      questionAsking: data.question_asking,
      responseLength: data.response_length,
      interests: data.interests || [],
      conversationTopics: data.conversation_topics || [],
      intellectualCuriosity: data.intellectual_curiosity,
      emotionalIntelligence: data.emotional_intelligence,
      lastAnalyzed: new Date(data.last_analyzed)
    };
  } catch (error) {
    console.error('Error getting user conversation pattern:', error);
    return null;
  }
};

/**
 * Calculates compatibility between two conversation patterns
 */
const calculateCompatibility = (pattern1: ConversationPattern, pattern2: any): UserCompatibility => {
  let score = 0;
  const reasons: string[] = [];
  
  // Shared interests (high weight)
  const sharedInterests = pattern1.interests.filter(interest => 
    pattern2.interests?.includes(interest)
  );
  score += sharedInterests.length * 15;
  if (sharedInterests.length > 0) {
    reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
  }

  // Complementary communication styles
  const styleCompatibility = getStyleCompatibility(pattern1.communicationStyle, pattern2.communication_style);
  score += styleCompatibility;
  if (styleCompatibility > 10) {
    reasons.push('Compatible communication styles');
  }

  // Similar curiosity levels (people who ask questions match well)
  const curiosityDiff = Math.abs(pattern1.curiosityLevel - pattern2.curiosity_level);
  score += Math.max(0, 20 - curiosityDiff);
  if (curiosityDiff < 15) {
    reasons.push('Similar curiosity levels');
  }

  // Intellectual curiosity alignment
  const intellectualDiff = Math.abs(pattern1.intellectualCuriosity - pattern2.intellectual_curiosity);
  score += Math.max(0, 15 - intellectualDiff);

  // Topic depth compatibility
  const depthDiff = Math.abs(pattern1.topicDepth - pattern2.topic_depth);
  score += Math.max(0, 10 - depthDiff);

  const matchReason = reasons.length > 0 ? reasons.join('; ') : 'General compatibility';

  return {
    userId1: pattern1.userId,
    userId2: pattern2.user_id,
    compatibilityScore: Math.min(100, score),
    sharedInterests,
    complementaryTraits: reasons,
    conversationPotential: score,
    matchReason,
    createdAt: new Date()
  };
};

/**
 * Determines compatibility between communication styles
 */
const getStyleCompatibility = (style1: string, style2: string): number => {
  const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
    analytical: { analytical: 15, philosophical: 20, creative: 10, empathetic: 8, direct: 12 },
    philosophical: { philosophical: 15, analytical: 20, creative: 18, empathetic: 15, direct: 5 },
    creative: { creative: 15, philosophical: 18, empathetic: 20, analytical: 10, direct: 8 },
    empathetic: { empathetic: 15, creative: 20, philosophical: 15, analytical: 8, direct: 10 },
    direct: { direct: 15, analytical: 12, empathetic: 10, creative: 8, philosophical: 5 }
  };

  return compatibilityMatrix[style1]?.[style2] || 5;
};

/**
 * Generates a personalized conversation starter between two matched users
 */
export const generateNetworkingConversationStarter = async (
  userId1: string, 
  userId2: string
): Promise<string> => {
  try {
    const [pattern1, pattern2] = await Promise.all([
      getUserConversationPattern(userId1),
      getUserConversationPattern(userId2)
    ]);

    if (!pattern1 || !pattern2) {
      return "Hi! I noticed we might have some interesting topics to discuss. What's something you've been curious about lately?";
    }

    const sharedInterests = pattern1.interests.filter(interest => 
      pattern2.interests.includes(interest)
    );

    if (sharedInterests.length > 0) {
      const interest = sharedInterests[0];
      
      // Try to get specific news/context for this interest
      const specificStarter = await generateContextualStarter(interest, pattern1.communicationStyle, pattern2.communicationStyle);
      if (specificStarter) {
        return specificStarter;
      }
      
      // Fallback with more specific questions per interest
      const interestQuestions = getInterestSpecificQuestions(interest);
      return `Hi! We both love ${interest}. ${interestQuestions}`;
    }

    // Fallback based on communication styles
    if (pattern1.communicationStyle === 'philosophical' || pattern2.communicationStyle === 'philosophical') {
      return "Hi! I have a feeling we might enjoy some deep conversations. What's a question you've been pondering lately?";
    }

    return "Hi! Based on our conversation patterns, I think we might have some fascinating discussions. What's something you're excited about right now?";
  } catch (error) {
    console.error('Error generating networking conversation starter:', error);
    return "Hi! I'd love to connect and learn more about your interests. What's something you're passionate about?";
  }
};

/**
 * Generate contextual conversation starters with recent news/developments
 */
const generateContextualStarter = async (interest: string, style1: string, style2: string): Promise<string | null> => {
  try {
    // Import newsService dynamically to avoid circular dependencies
    const { newsService } = await import('./newsService');
    
    // Get recent articles (all categories)
    const articles = await newsService.fetchCurrentNews();
    if (!articles || articles.length === 0) return null;
    
    // Filter articles related to the interest
    const relevantArticles = articles.filter(article => 
      article.category?.toLowerCase() === interest.toLowerCase() ||
      article.title.toLowerCase().includes(interest.toLowerCase()) ||
      article.description?.toLowerCase().includes(interest.toLowerCase())
    );
    
    if (relevantArticles.length === 0) return null;
    
    // Pick a recent, engaging article from relevant ones
    const recentArticle = relevantArticles[0];
    if (!recentArticle) return null;
    
    // Generate starter based on communication styles
    const isAnalytical = style1 === 'analytical' || style2 === 'analytical';
    const isCreative = style1 === 'creative' || style2 === 'creative';
    const isPhilosophical = style1 === 'philosophical' || style2 === 'philosophical';
    
    // Truncate article title if too long
    const maxTitleLength = 60;
    const truncatedTitle = recentArticle.title.length > maxTitleLength 
      ? recentArticle.title.substring(0, maxTitleLength) + '...'
      : recentArticle.title;
    
    if (isAnalytical) {
      return `Hi! We both love ${interest}. Saw this: "${truncatedTitle}" - your analysis?`;
    } else if (isCreative) {
      return `Hi! We both love ${interest}. This caught my eye: "${truncatedTitle}" - creative thoughts?`;
    } else if (isPhilosophical) {
      return `Hi! We both love ${interest}. Reflecting on: "${truncatedTitle}" - deeper questions?`;
    } else {
      return `Hi! We both love ${interest}. Saw: "${truncatedTitle}" - your take?`;
    }
  } catch (error) {
    console.log('Could not generate contextual starter:', error);
    return null;
  }
};

/**
 * Get specific questions for different interests
 */
const getInterestSpecificQuestions = (interest: string): string => {
  const questions: { [key: string]: string[] } = {
    technology: [
      "Latest AI thoughts?",
      "Exciting tech trends?",
      "Coolest innovation lately?",
      "Tech changing daily life?"
    ],
    science: [
      "Recent breakthrough?",
      "Interesting research?",
      "Mind-blowing fact?",
      "Biggest impact field?"
    ],
    philosophy: [
      "Question on your mind?",
      "Exploring any concepts?",
      "Life-changing idea?",
      "Favorite thinker?"
    ],
    business: [
      "Trends you're watching?",
      "Cool startups?",
      "Innovative models?",
      "Business evolution?"
    ],
    health: [
      "Wellness trends?",
      "Medical research?",
      "Health approach?",
      "Game-changing innovation?"
    ],
    environment: [
      "Exciting solutions?",
      "Climate tech?",
      "Sustainability wins?",
      "Priority challenge?"
    ]
  };
  
  const interestQuestions = questions[interest.toLowerCase()] || [
    "What interests you most?",
    "Recent developments?",
    "What got you started?",
    "Most exciting part?"
  ];
  
  return interestQuestions[Math.floor(Math.random() * interestQuestions.length)];
};
