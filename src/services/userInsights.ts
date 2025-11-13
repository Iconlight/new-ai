import { supabase } from './supabase';

export interface PersonalInsights {
  conversationStyle: string;
  topTopics: Array<{ name: string; count: number }>;
  questionCount: number;
  answerCount: number;
  compatibleStyles: string[];
  networkGrowth: Array<{ month: string; count: number }>;
  meaningfulThisMonth: number;
  summary: string;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function styleFor(qRatio: number): string {
  if (qRatio >= 0.45) return 'Deep Explorer';
  if (qRatio >= 0.28) return 'Analytical Synthesizer';
  if (qRatio >= 0.15) return 'Curious Builder';
  return 'Practical Optimizer';
}

function compatibleFor(style: string): string[] {
  switch (style) {
    case 'Deep Explorer':
      return ['Strategic Visionary', 'Curious Builder'];
    case 'Analytical Synthesizer':
      return ['Creative Challenger', 'Practical Optimizer'];
    case 'Curious Builder':
      return ['Deep Explorer', 'Creative Challenger'];
    default:
      return ['Analytical Synthesizer', 'Curious Builder'];
  }
}

export async function getPersonalInsights(userId: string): Promise<PersonalInsights> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { data: chats } = await supabase
    .from('chats')
    .select('id,title,news_context')
    .eq('user_id', userId);

  const chatIds = (chats || []).map(c => c.id);

  let questionCount = 0;
  let answerCount = 0;
  let meaningfulThisMonth = 0;

  if (chatIds.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('chat_id, role, content, created_at')
      .in('chat_id', chatIds);

    const byChat: Record<string, number> = {};

    (msgs || []).forEach(m => {
      if (m.role === 'user' && typeof m.content === 'string' && m.content.includes('?')) questionCount++;
      if (m.role === 'assistant') answerCount++;
      const created = new Date(m.created_at);
      if (created >= startOfMonth) byChat[m.chat_id] = (byChat[m.chat_id] || 0) + 1;
    });

    meaningfulThisMonth = Object.values(byChat).filter(c => c >= 10).length;
  }

  const qRatio = questionCount + answerCount > 0 ? questionCount / (questionCount + answerCount) : 0;
  const conversationStyle = styleFor(qRatio);
  const compatibleStyles = compatibleFor(conversationStyle);

  const topicCounts: Record<string, number> = {};

  const { data: saved } = await supabase
    .from('saved_topics')
    .select('category')
    .eq('user_id', userId);

  (saved || []).forEach(r => {
    if (r.category) topicCounts[r.category] = (topicCounts[r.category] || 0) + 1;
  });

  if (Object.keys(topicCounts).length === 0 && chats?.length) {
    chats.forEach(c => {
      const cat = (c as any).news_context?.category;
      if (cat) topicCounts[cat] = (topicCounts[cat] || 0) + 1;
    });
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const { data: convos } = await supabase
    .from('networking_conversations')
    .select('id, created_at, user_id_1, user_id_2')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  const growthMap: Record<string, number> = {};
  const cursor = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i++) {
    growthMap[monthKey(cursor)] = 0;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  (convos || []).forEach(c => {
    const d = new Date(c.created_at);
    if (d >= sixMonthsAgo) {
      const key = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
      growthMap[key] = (growthMap[key] || 0) + 1;
    }
  });

  const networkGrowth = Object.entries(growthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const monthName = now.toLocaleString(undefined, { month: 'long' });
  const topicsSummary = topTopics.map(t => t.name).slice(0, 3).join(', ') || 'varied topics';
  const summary = `Your ${monthName} on ProactiveAI: ${meaningfulThisMonth} meaningful conversations, style: ${conversationStyle}, top: ${topicsSummary}.`;

  return {
    conversationStyle,
    topTopics,
    questionCount,
    answerCount,
    compatibleStyles,
    networkGrowth,
    meaningfulThisMonth,
    summary,
  };
}
