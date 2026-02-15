import { NextRequest, NextResponse } from 'next/server';
import db from '@/server/db/database';

const CURRENT_USER_ID = 2;

type ConversationRow = {
  threadId: number;
  partnerId: number;
  partnerName: string;
  latestMessage: string;
  latestAt: string;
  unreadCount: number;
};

type MessageRow = {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
};

function formatRelativeTime(isoDateText: string) {
  const target = new Date(isoDateText.replace(' ', 'T'));
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;

  return target.toLocaleDateString('ja-JP');
}

function buildDmResponse(threadIdParam?: number | null) {
  const currentUserId = CURRENT_USER_ID;

  const conversations = db
    .prepare(
      `
      SELECT
        t.id AS threadId,
        CASE WHEN t.user_a_id = @currentUserId THEN t.user_b_id ELSE t.user_a_id END AS partnerId,
        COALESCE(u.display_name, u.username) AS partnerName,
        (
          SELECT m2.content
          FROM dm_messages m2
          WHERE m2.thread_id = t.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS latestMessage,
        (
          SELECT m2.created_at
          FROM dm_messages m2
          WHERE m2.thread_id = t.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS latestAt,
        (
          SELECT COUNT(*)
          FROM dm_messages m3
          WHERE m3.thread_id = t.id
            AND m3.sender_id != @currentUserId
            AND m3.is_read = 0
        ) AS unreadCount
      FROM dm_threads t
      JOIN users u
        ON u.id = CASE WHEN t.user_a_id = @currentUserId THEN t.user_b_id ELSE t.user_a_id END
      WHERE t.user_a_id = @currentUserId OR t.user_b_id = @currentUserId
      ORDER BY latestAt DESC
      `
    )
    .all({ currentUserId }) as ConversationRow[];

  if (conversations.length === 0) {
    return NextResponse.json({
      currentUserId,
      conversations: [],
      activeThreadId: null,
      activePartnerName: '',
      messages: [],
    });
  }

  const activeThreadId = Number(threadIdParam || conversations[0].threadId);
  const activeConversation =
    conversations.find((item) => item.threadId === activeThreadId) ?? conversations[0];

  const messages = db
    .prepare(
      `
      SELECT id, sender_id, content, created_at
      FROM dm_messages
      WHERE thread_id = ?
      ORDER BY created_at ASC
      `
    )
    .all(activeConversation.threadId) as MessageRow[];

  return NextResponse.json({
    currentUserId,
    activeThreadId: activeConversation.threadId,
    activePartnerName: activeConversation.partnerName,
    conversations: conversations.map((item) => ({
      threadId: item.threadId,
      partnerId: item.partnerId,
      partnerName: item.partnerName,
      preview: item.latestMessage || 'メッセージはまだありません',
      time: item.latestAt ? formatRelativeTime(item.latestAt) : '',
      unread: item.unreadCount > 0,
      online: item.partnerId % 2 === 1,
    })),
    messages: messages.map((message) => ({
      id: message.id,
      content: message.content,
      isMine: message.sender_id === currentUserId,
    })),
  });
}

export async function GET(request: NextRequest) {
  const threadIdParam = request.nextUrl.searchParams.get('threadId');
  const numericThreadId = threadIdParam ? Number(threadIdParam) : null;

  return buildDmResponse(numericThreadId);
}

export async function POST(request: NextRequest) {
  const currentUserId = CURRENT_USER_ID;

  try {
    const body = (await request.json()) as { threadId?: number; content?: string };
    const threadId = Number(body.threadId);
    const content = (body.content || '').trim();

    if (!Number.isFinite(threadId) || threadId <= 0 || !content) {
      return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
    }

    const canAccessThread = db
      .prepare(
        `
        SELECT id
        FROM dm_threads
        WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)
        `
      )
      .get(threadId, currentUserId, currentUserId);

    if (!canAccessThread) {
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    db.prepare(
      `
      INSERT INTO dm_messages (thread_id, sender_id, content, is_read, created_at)
      VALUES (?, ?, ?, 1, ?)
      `
    ).run(threadId, currentUserId, content, now);

    return buildDmResponse(threadId);
  } catch {
    return NextResponse.json({ error: 'メッセージ送信に失敗しました' }, { status: 500 });
  }
}
